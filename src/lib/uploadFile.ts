import COS from "cos-nodejs-sdk-v5";
import fs from "fs";

const fileToBase64 = (filePath: string) => {
    // 读取文件的内容
    const fileContent = fs.readFileSync(filePath);
  
    // 将文件内容转换为Buffer对象
    const buffer = Buffer.from(fileContent);
  
    // 将Buffer对象转换为base64编码字符串
    const base64Str = buffer.toString("base64");
  
    return base64Str;
};

export default async function cosUpload(file: string, fileName: string) {
  const cos = new COS({
    SecretId: process.env.COS_SECRETID,
    SecretKey: process.env.COS_SECRETKEY
  });

  const params:any = {
    Bucket: "video-1255988328", // 替换为你的存储桶名称
    Region: "ap-nanjing", // 替换为你的存储桶所在区域
    Key: fileName, // 上传到 COS 的文件名
    FilePath: file
  };

  try {
    const data = await cos.uploadFile(params);
    console.log("cos上传成功");
    return data?.Location
  } catch (error) {
    console.error("cos上传失败", error);
    return ''
  }
}
