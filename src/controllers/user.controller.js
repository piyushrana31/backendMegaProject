import { asyncHandler } from '../utils/asyncHandler.utils.js';
import { ApiError } from '../utils/apiError.utils.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.utils.js';

const registerUser = asyncHandler( async (req, res) => {
    // get user data from frontend

    const { fullName, username, email, password } = req.body;
    console.log("Email: ", email);
    console.log("fullName: ", fullName);
    console.log("username: ", username);
    console.log("password: ", password);
    // validation - "not empty", "valid email", "password strength", etc.

    if (
        [fullName, username, email, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }
    // check if user already exists: username or email

    const existingUser = User.findOne({
        $or: [{ username }, { email }]
    });

    if(existingUser) {
        throw new ApiError(409, "User with same username or email exists!");
    }
    // check for images/avatar

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required!");
    }
    // upload avatar to cloud storage (optional)

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar) {
        throw new ApiError(400, "Avatar is required!");
    }
    // create user object - create entry in DB

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url,
        email,
        password,
        username: username.toLowerCase()
    })
    //  remove password and refreshToken from response

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    // check for user creation

    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user.");
    }
    // return res

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully!!")
    )
});

export { registerUser };