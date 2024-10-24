const router = require("express").Router();
const User = require("../models/User");
const Post = require("../models/Post");
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'blog_images',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `blog_image_${uniqueSuffix}`;
    }
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

// CREATE POST
router.post("/", upload.single('file'), async (req, res) => {
  try {
    const { username, title, desc } = req.body;
    let newPost = new Post({
      username,
      title,
      desc
    });

    if (req.file) {
      // Store both the URL and secure URL
      newPost.photo = req.file.path;
      newPost.secure_url = req.file.secure_url;
    }

    const savedPost = await newPost.save();
    console.log("Created post with image:", savedPost); // Debug log
    res.status(200).json(savedPost);
  } catch (err) {
    console.error("Error creating post:", err);
    res.status(500).json(err);
  }
});

// UPDATE POST
router.put("/:id", upload.single('file'), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    if (post.username === req.body.username) {
      try {
        const updatedData = {
          title: req.body.title,
          desc: req.body.desc
        };

        // If there's a new file, upload it and delete the old one
        if (req.file) {
          // Delete old image if it exists
          if (post.photo) {
            const oldPublicId = getPublicIdFromUrl(post.photo);
            if (oldPublicId) {
              await cloudinary.uploader.destroy(oldPublicId);
            }
          }

          updatedData.photo = req.file.path;
          updatedData.secure_url = req.file.secure_url;
        }

        const updatedPost = await Post.findByIdAndUpdate(
          req.params.id,
          { $set: updatedData },
          { new: true }
        );

        console.log("Updated post:", updatedPost); // Debug log
        res.status(200).json(updatedPost);
      } catch (err) {
        console.error("Error updating post:", err);
        res.status(500).json(err);
      }
    } else {
      res.status(401).json("You can update only your post!");
    }
  } catch (err) {
    console.error("Error finding post:", err);
    res.status(500).json(err);
  }
});

// DELETE POST
router.delete("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    if (post.username === req.body.username) {
      try {
        // Delete image from Cloudinary if it exists
        if (post.photo) {
          const publicId = getPublicIdFromUrl(post.photo);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId);
          }
        }

        await post.delete();
        res.status(200).json("Post has been deleted...");
      } catch (err) {
        console.error("Error deleting post:", err);
        res.status(500).json(err);
      }
    } else {
      res.status(401).json("You can delete only your post!");
    }
  } catch (err) {
    console.error("Error finding post:", err);
    res.status(500).json(err);
  }
});

// GET POST
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json("Post not found");
    }
    res.status(200).json(post);
  } catch (err) {
    console.error("Error getting post:", err);
    res.status(500).json(err);
  }
});

// GET ALL POSTS
router.get("/", async (req, res) => {
  const username = req.query.user;
  const catName = req.query.cat;
  try {
    let posts;
    if (username) {
      posts = await Post.find({ username });
    } else if (catName) {
      posts = await Post.find({
        categories: {
          $in: [catName],
        },
      });
    } else {
      posts = await Post.find();
    }
    res.status(200).json(posts);
  } catch (err) {
    console.error("Error getting posts:", err);
    res.status(500).json(err);
  }
});

module.exports = router;