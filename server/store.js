const db=require("./db");
const util=require("./utils")
const fs=require('fs')
const path=require('path')
module.exports ={
  saveUser(user,status){
    console.log(user.name,status);
    if(status==='login'){
      return new Promise((resolve, reject) => {
        db.user.insert(user,(err,newUser) => {
          if(err){
            reject(err)
          }else {
            resolve(newUser)
          }
        })
      })
    }
  },
  saveMessage(from,to,message,type){
    if(type==='image'){
      const base64Data = message.replace(/^data:image\/\w+;base64,/, "")
      const dataBuffer = Buffer.from(base64Data,'base64')
      const filename = util.MD5(base64Data)
      // 使用绝对路径确保跨平台兼容性
      const uploadDir = path.join(__dirname, 'upload')
      // 确保upload目录存在
      if(!fs.existsSync(uploadDir)) {
        try {
          fs.mkdirSync(uploadDir, { recursive: true })
          console.log('创建upload目录成功')
        } catch (err) {
          console.error('创建upload目录失败:', err)
          // 继续处理，尝试保存消息
        }
      }
      // 完整的图片文件路径
      const imgPath = path.join(uploadDir, `${filename}.png`)
      // 改为异步写入，避免阻塞事件循环
      fs.writeFile(imgPath, dataBuffer, (err) => {
        if(err) {
          console.error('保存图片失败:', err)
        } else {
          console.log('图片保存成功:', imgPath)
        }
      })
      // 生成可访问的图片URL路径，与index.js中的静态文件配置一致
      message = `/upload/${filename}.png`
    }
    console.log("\x1b[36m"+from.name+"\x1b[0m对<\x1b[36m"+to.name+"\x1b[0m>:\x1b[32m"+message+"\x1b[0m")
    const doc={
      from,
      to,
      content:message,
      type,
      time:new Date().getTime()
    }
    return new Promise((resolve, reject) => {
      db.message.insert(doc,(err,newDoc) => {
        if(err){
          console.error('保存消息失败:', err)
          reject(err)
        }else {
          resolve(newDoc)
        }
      })
    })
  },
  getMessages() {
    return new Promise((resolve, reject) => {
      db.message.find({}).sort({time:1}).skip(0).limit(100).exec((err,docs) => {
        if(err){
          reject(err)
        }else {
          resolve(docs)
        }
      })
    })
  },
  getUsers(){
    return new Promise((resolve, reject) => {
      db.user.find({}).sort({time:1}).skip(0).limit(100).exec((err,docs) => {
        if(err){
          reject(err)
        }else {
          resolve(docs)
        }
      })
    })
  }
};
