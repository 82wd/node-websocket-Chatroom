const io = require('socket.io')({
  cors: {
    origin: '*',
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
  serveClient:false,
  // 增加消息大小限制到6MB（考虑base64编码会增加约33%的大小）
  maxHttpBufferSize: 6 * 1024 * 1024
});
const jwt=require("./jwt");
const store=require("./store");
const { filterText } = require('./sensitive');
util={
  async login(user,socket,isReconnect) {
    let ip=socket.handshake.address.replace(/::ffff:/,"");
    const headers = socket.handshake.headers;
    const realIP = headers['x-forwarded-for'];
    ip=realIP?realIP:ip;
    const deviceType=this.getDeviceType(socket.handshake.headers["user-agent"].toLowerCase());
    user.ip=ip;
    user.deviceType=deviceType;
    user.roomId=socket.id;
    user.type='user';
    if(isReconnect){
      this.loginSuccess(user,socket);
      console.log(`用户<${user.name}>重新链接成功！`)
    }else {
      const flag=await this.isHaveName(user.name);
      if(!flag){
        user.id=socket.id;
        user.time=new Date().getTime();
        this.loginSuccess(user,socket);
        store.saveUser(user,'login')
        const messages = await store.getMessages();
        socket.emit("history-message","group_001",messages);
      }else {
        console.log(`登录失败,昵称<${user.name}>已存在!`)
        socket.emit('loginFail','登录失败,昵称已存在!')
      }
    }
  },
  async loginSuccess(user, socket) {
    const data={
      user:user,
      token:jwt.token(user)
    };
    socket.broadcast.emit('system', user, 'join');
    socket.on('message', async (from, to, message, type)=> {
      // 仅对群聊消息进行敏感词替换，私聊不替换
      if (to && to.type === 'group' && typeof message === 'string') {
        try {
          message = filterText(message);
        } catch (e) {
          console.error('敏感词过滤出错', e);
        }
      }

      // 群聊 @ 功能：解析 @username 或 @all/@所有人，并发送单独的 mention 事件
      if (to && to.type === 'group' && typeof message === 'string') {
        try {
          const mentionRegex = /@([\w\u4e00-\u9fa5\-\_\.]{1,30})/g;
          const mentions = [];
          let m;
          while ((m = mentionRegex.exec(message)) !== null) {
            mentions.push(m[1]);
          }

          if (mentions.length > 0) {
            // 支持 @all / @所有人 / @everyone 群体提醒
            const isAll = mentions.some(n => /^(all|所有人|everyone)$/i.test(n));
            if (isAll) {
              // 广播 mention（包括发送者回显）
              socket.broadcast.emit('mention', { from: socket.user, to, message, type, isAll: true });
              socket.emit('mention', { from: socket.user, to, message, type, isAll: true });
            } else {
              // 单独通知被@的在线用户
              const clients = await io.fetchSockets();
              const notified = new Set();
              for (const name of mentions) {
                for (const client of clients) {
                  if (client.user && client.user.name === name && !notified.has(client.id)) {
                    // 发送 mention 给目标用户（回显给发送者也发送一次）
                    io.to(client.id).emit('mention', { from: socket.user, to, message, type, name });
                    notified.add(client.id);
                  }
                }
              }
              // 回显给发送者（可用于本地高亮）
              if (notified.size > 0) {
                socket.emit('mention-sent', { from: socket.user, to, message, type, names: Array.from(notified) });
              }
            }
          }
        } catch (e) {
          console.error('处理 @ 提及出错', e);
        }
      }

      if (to && to.type === 'user') {
        // 使用 io.to 确保发送到目标 socket id；并回显给发送者
        io.to(to.roomId).emit('message', socket.user, to, message, type);
        socket.emit('message', socket.user, to, message, type);
      }
      if (to && to.type === 'group') {
        socket.broadcast.emit('message', socket.user, to, message, type);
        store.saveMessage(from, to, message, type);
      }
    });
    const users=await this.getOnlineUsers();
    socket.user=user;
    socket.emit('loginSuccess', data, users);
  },
  //根据useragent判读设备类型
  getDeviceType(userAgent){
    let bIsIpad = userAgent.match(/ipad/i) == "ipad";
    let bIsIphoneOs = userAgent.match(/iphone os/i) == "iphone os";
    let bIsMidp = userAgent.match(/midp/i) == "midp";
    let bIsUc7 = userAgent.match(/rv:1.2.3.4/i) == "rv:1.2.3.4";
    let bIsUc = userAgent.match(/ucweb/i) == "ucweb";
    let bIsAndroid = userAgent.match(/android/i) == "android";
    let bIsCE = userAgent.match(/windows ce/i) == "windows ce";
    let bIsWM = userAgent.match(/windows mobile/i) == "windows mobile";
    if (bIsIpad || bIsIphoneOs || bIsMidp || bIsUc7 || bIsUc || bIsAndroid || bIsCE || bIsWM) {
      return "phone";
    } else {
      return "pc";
    }
  },
  //获取在线用户列表
  async getOnlineUsers(){
    const users=[
      {
        id:"group_001",
        name:"群聊天室",
        avatarUrl:"static/img/avatar/group-icon.png",
        type:"group"
      }
    ];
    const clients=await io.fetchSockets();
    clients.forEach((item) => {
      if(item.user){
        users.push(item.user)
      }
    })
    return users;
  },
  //判断用户是否已经存在
  async isHaveName(name){
    const users=await this.getOnlineUsers();
    return users.some(item => item.name===name)
  },
};
io.sockets.on('connection',(socket)=>{
  const token=socket.handshake.headers.token;
  let decode=null;
  if(token){
    decode=jwt.decode(token);
  }
  let user=decode?decode.data:{};
  socket.on("disconnect",(reason)=>{
    //判断是否是已登录用户
    if (socket.user&&socket.user.id) {
      //删除登录用户信息,并通知所有在线用户
      socket.broadcast.emit('system', socket.user, 'logout');
      store.saveUser(socket.user,'logout')
    }
    console.log(reason)
  });
  //判断链接用户是否已经登录
  if(user&&user.id){
    //已登录的用户重新登录
    util.login(user,socket,true);
  }else {
    //监听用户登录事件
    socket.on('login',(user)=>{
      util.login(user,socket,false)
    });
  }
});
module.exports=io;

io.on('connection', (socket) => {
  // ...existing code...

  // 把 message 事件处理器放在这里，确保 socket 已定义
  socket.on('message', (msg) => {
    try {
      // 根据项目实际字段调整私聊判断逻辑
      const isPrivate = Boolean(msg && (msg.isPrivate || (msg.to && msg.to !== 'chatroom' && msg.to !== 'global')));

      if (!isPrivate && msg && typeof msg.content === 'string') {
        msg.content = filterText(msg.content);
      }
    } catch (err) {
      // 容错：日志或忽略
      console.error('消息过滤出错', err);
    }

    // ...existing code that广播/处理 msg ...
  });

  // ...existing code...
});
