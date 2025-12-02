import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localStorage) => {
    try {
        if(!localStorage) return null;

        const response = await cloudinary.uploader.upload(localStorage, {
            resource_type: "auto"
        });

        console.log("File uplaoded on cloudinary!", response.url);
        return response;
    } catch(error) {
        fs.unlink(localStorage); // remove the locally saved temporary file as the upload operation got failed.
        
        return null;
    }
}

export { uploadOnCloudinary };