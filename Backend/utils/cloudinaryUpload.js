import cloudinary from '../config/cloudinary.js'

export const uploadBufferToCloudinary = async (buffer, folder, options = {}) => {
  const uploadOptions = { folder, ...options }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error)
      return resolve(result)
    })

    stream.end(buffer)
  })
}
