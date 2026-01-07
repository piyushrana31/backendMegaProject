import { asyncHandler } from '../utils/asyncHandler.utils.js';
import { ApiError } from '../utils/apiError.utils.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.utils.js';

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessTokens();
        const refreshToken = user.generateRefreshTokens();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return {accessToken, refreshToken};

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens");
    }
}

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

    const existingUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if(existingUser) {
        throw new ApiError(409, "User with same username or email already exists!");
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

const loginUser = asyncHandler(async(req, res) => {
    // req body se data lena h

    const {email, username, password} = req.body
    // username or email based login

    if(!(username || email)) {
        throw new ApiError(400, "username or email is required!");
    }
    // find the user

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user) {
        throw new ApiError(404, "User does not exists.");
    }
    // password check

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid) {
        throw new ApiError(401, "Invalid login credentials");
    }
    // if password is correct then, access token and refresh token create karo

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    // send cookie

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("AccessToken", accessToken, options)
    .cookie("RefreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully!"
        )
    )
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            refreshToken: null
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("AccessToken", options)
    .clearCookie("RefreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully!"));
})

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req?.cookies?.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request!");
    }

    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET,
    )

    const user = await User.findById(decodedToken?._id);

    if(!user) {
        throw new ApiError(401, "Invalid Refresh Token");
    }

    const {newAccessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id);

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("AccessToken", newAccessToken, options)
    .cookie("RefreshToken", newRefreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            },
            "Access token refreshed successfully!"
        )
    )

})

export { registerUser, loginUser, logoutUser, refreshAccessToken };