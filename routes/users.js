const router = require("express").Router();
const User = require("../models/User");
const Post = require("../models/Post");
const bcrypt = require("bcrypt");
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary storage for profile photos
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profile_photos',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ 
      width: 500, 
      height: 500, 
      crop: 'fill', 
      gravity: 'face' 
    }],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `profile_${uniqueSuffix}`;
    }
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Helper function to extract public_id from Cloudinary URL
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  try {
    const splitUrl = url.split('/');
    const filename = splitUrl[splitUrl.length - 1];
    return filename.split('.')[0];
  } catch (err) {
    console.error("Error extracting public_id:", err);
    return null;
  }
};

//UPDATE
router.put("/:id", upload.single('profilePic'), async (req, res) => {
  if (req.body.userId === req.params.id) {
    // Handle password update
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    }
    
    try {
      // Get current user to check for existing profile photo
      const currentUser = await User.findById(req.params.id);
      
      const updateData = { ...req.body };
      
      // Handle profile photo update if a new file is uploaded
      if (req.file) {
        // Delete old profile photo if it exists
        if (currentUser.profilePic) {
          const oldPublicId = getPublicIdFromUrl(currentUser.profilePic);
          if (oldPublicId) {
            await cloudinary.uploader.destroy(oldPublicId);
          }
        }
        
        // Add new profile photo URLs to update data
        updateData.profilePic = req.file.path;
        updateData.secure_profilePic = req.file.secure_url;
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        {
          $set: updateData,
        },
        { new: true }
      );
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser._doc;
      res.status(200).json(userWithoutPassword);
    } catch (err) {
      console.error("Error updating user:", err);
      res.status(500).json(err);
    }
  } else {
    res.status(401).json("You can update only your account!");
  }
});

//DELETE
router.delete("/:id", async (req, res) => {
  if (req.body.userId === req.params.id) {
    try {
      const user = await User.findById(req.params.id);
      try {
        // Delete profile photo from Cloudinary if it exists
        if (user.profilePic) {
          const publicId = getPublicIdFromUrl(user.profilePic);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId);
          }
        }
        
        await Post.deleteMany({ username: user.username });
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json("User has been deleted...");
      } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json(err);
      }
    } catch (err) {
      res.status(404).json("User not found!");
    }
  } else {
    res.status(401).json("You can delete only your account!");
  }
});

//GET USER
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const { password, ...others } = user._doc;
    res.status(200).json(others);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;