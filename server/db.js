const mongoose = require('mongoose');
const Schema = mongoose.Schema;

mongoose.connect('mongodb://127.0.0.1:27017/blog', { useNewUrlParser: true });

const userSchema = new Schema({
  username: String,
  password: String,
  token: String,
  creation_at: Number
});

const categorySchema = new Schema({
    name: String
});

const articleSchema = new Schema({
    title: String,
    release: Boolean,
    describe: String,
    content: String,
    categories: String,
    image_src: String,
    browsing: Number,
    creation_at: Number,
    update_at: Number,
    comments: [
        {
          type: Schema.Types.ObjectId,
          ref: "comments"
        }
    ]
});

const guestbookSchema = new Schema({
    ip: String,
    reply_id: String,
    reply_user: String,
    content: String,
    user_name: String,
    email: String,
    city: String,
    avatar: String,
    replys: [
        {
          type: Schema.Types.ObjectId,
          ref: "guestbooks"
        }
    ],
    creation_at: Number
});

const commentSchema = new Schema({
    ip: String,
    article_id: String,
    reply_id: String,
    reply_user: String,
    content: String,
    user_name: String,
    email: String,
    city: String,
    avatar: String,
    replys: [
      {
        type: Schema.Types.ObjectId,
        ref: "comments"
      }
    ],
    creation_at: Number
});

module.exports = {
    User: mongoose.model("user", userSchema),
    Category: mongoose.model("categories", categorySchema),
    Article: mongoose.model("articles", articleSchema),
    Guestbook: mongoose.model("guestbooks", guestbookSchema),
    Comment: mongoose.model("comments", commentSchema)
}