const express = require("express");
const router = express.Router();
const db = require("./db");
const bodyParser = require("body-parser");
const request = require("request");
const common = require("./common");

// 七牛资源管理
const qiniu = require("qiniu");
const qn = require("qn");
const upload = require("./common").upload;

var mac = new qiniu.auth.digest.Mac(
  common.qn_config.accessKey,
  common.qn_config.secretKey
),
config = new qiniu.conf.Config();

config.zone = qiniu.zone.Zone_z0;
var bucketManager = new qiniu.rs.BucketManager(mac, config),
bucket = common.qn_config.bucket;

// 对body进行解析
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

// 跨域配置
const url =
  process.env.NODE_ENV === "production" ? "http://www.wuzhengwu.top" : "*";

router.all("*", function(req, res, next) {
  origin =
    req.path === "/api/getWeather" || req.path === "/api/bing" ? "*" : url;

  if (
    origin === "*" ||
    (req.headers.origin && req.headers.origin.indexOf("wuzhengwu.top") != -1)
  ) {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Credentials", true);
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Content-Length, Authorization, Accept, X-Requested-With , yourHeaderFeild"
    );
    res.header(
      "Access-Control-Allow-Methods",
      "PUT, POST, GET, DELETE, OPTIONS"
    );
  }
  next();
});

/**
 * 接口回调
 * @param {err}     错误信息
 * @param {res}     请求来源
 * @param {result}  第三方接口、mongodb请求 result
 * @param {data}    请求成功返回数据 {}
 * @param {message} 提示信息 ["登录成功"，"账号或密码不正确"，"请求失败"]
 */
const callback = (err, res, result, data, message) => {
    // 请求状态  0：请求成功  1：数据不存在  2：接口报错
    let status = err ? 2 : result ? 0 : 1;
  
    return res
      .status(status === 2 ? 500 : 200)
      .jsonp({
        code: status,
        data: status === 0 ? data : {},
        message: status === 2 ? err.message : message[status]
      })
      .end();
};

/**
 * 请求失败回调
 * @param {res}     请求来源
 * @param {message} 错误提示
 *
 * @return
 */
const errorCallback = (res, message = "请求失败") => {
    return res
      .status(200)
      .jsonp({
        code: 1,
        data: {},
        message: message
      })
      .end();
};

/**
 * 必应每日壁纸
 * @return {壁纸url}
 */
router.get("/api/bing", (req, res) => {
  let format = 'js'   //返回数据格式，不存在返回xml格式
  let idx = '0'       //请求图片截止天数
  let n = '1'         //1-8 返回请求数量，目前最多一次获取8张
  let mkt = 'zh-CN'   //地区

  let proxy_url = "https://cn.bing.com/HPImageArchive.aspx?"+`format=${format}&idx=${idx}&n=${n}&mkt=${mkt}`;
  let options = {
    url: proxy_url,
    headers: { Connection: "close" },
    method: "GET",
    json: true
  };

  request(options, (err, result, data) => {
    callback(err, res, result, data, ["获取图片成功", "数据有误"]);
  });
});

/**
 * 获取分类列表
 * @return {分类列表}
 */
router.post("/api/getCategoryList", (req, res) => {
  db.Category.find((err, result) => {
    callback(err, res, result, result, ["获取列表成功", "数据有误"]);
  })
})

/**
 * 添加分类
 * @return {分类列表}
 */
router.post("/api/addCategorys", (req, res) => {
  let category = new db.Category(req.body);

  category.save((err, result) => {
    if (!err){
      callback(err, res, result, {}, ["添加成功", "数据有误"]);
    }
  })
})

/**
 * 删除分类
 * @param {String} id - 分类id
 */
router.post("/api/deleteTag", (req, res) => {
  db.Category.deleteOne(
    { _id: req.body.id },
    (err, result) => {
      callback(err, res, result, {}, [
        "删除成功",
        "删除失败"
      ]);
    }
  )
})

/**
 * 获取博客列表
 * @param {String}  categories - 类别
 * @param {Number}  page - 请求页数 默认为1
 * @return {文章列表}
 */
router.post("/api/getArticlesList", (req, res) => {
    let categories = req.body.Category, // 文章类别
    page = Number(req.body.page || 1), // 获取第几页文章列表
    criteria = {} // 查询条件

    if (categories && categories != "全部") {
      criteria.categories = { $in: [categories] };
    }


    db.Article.find(criteria).exec((err, result) => {
        callback(
            err,
            res,
            result,
            {
                currentPage: page,
                data: result
            },
            ["获取列表成功", "获取列表失败"]
        )
    })

})

/**
 * 获取文章详情
 * @param {_id}         文章id（用于获取文章详情）
 * @return {detail}
 */
router.post("/api/getArticlesDetail", (req, res) => {
  let _id = req.body._id,
    criteria = {}; // 查询条件

  criteria._id = _id;

  db.Article.updateOne(criteria, { $inc: { browsing: 1 } }, () => {});

  db.Article.findOne(criteria)
  .populate({
    path: "comments",
    populate: { path: "replys" }
  })
  .exec((err, result) => {
      callback(
          err,
          res,
          result,
          result,
          ["获取详情成功", "获取详情失败"]
      );
  });
});

/**
 * 添加、编辑文章
 * @param {_id}         文章id (编辑标示)
 * @param {title}       标题
 * @param {release}     是否发布
 * @param {categories}  分类
 * @param {image_src}   封面图
 * @param {describe}    描述
 * @param {content}     文章内容
 * @param {type}        操作类型  save：添加。 update：编辑。
 * @return {status}
 */
router.post("/api/operateArticles", (req, res) => {
  let type = req.body.type,
    dataForm = req.body

    if(type === 'update'){
      let _id = req.body._id
      dataForm.update_at = Date.parse(new Date());
      db.Article.updateOne({ _id: _id }, dataForm, (err, result) => {
        callback(err, res, result, {}, ["修改成功", "数据有误"]);
      });

    }else if(type === 'save'){
      dataForm.creation_at = Date.parse(new Date());
      dataForm.browsing = 0
      let article = new db.Article(dataForm);

      article.save((err, result) => {
        if (!err){
          callback(err, res, result, {}, ["添加成功", "数据有误"]);
        }
      })
    }
})

/**
 * 删除文章
 * @param {String} id - 标签id
 */
router.post("/api/deleteArticle", (req, res) => {
  db.Article.deleteOne(
    { _id: req.body.id },
    (err, result) => {
      callback(err, res, result, {}, [
        "删除成功",
        "删除失败"
      ]);
    }
  )
})

/**
 * 获取留言列表
 */
router.post("/api/getGuestbookList", (req, res) => {
  db.Guestbook.find({ reply_id: { $exists: false } })
    .populate({
      path: "replys"
    })
    .exec((err, result) => {
      callback(err, res, result, result, ["获取留言成功", "获取留言失败"]);
    });
});

/**
 * 发表留言
 * @param {String} id - 留言id
 * @param {String} content - 内容
 * @param {String} user_name - 昵称
 * @param {String} city - 城市信息
 * @param {String} avatar - 头像
 * @param {String} reply_user - 回复用户的昵称
 * @param {String}  email - 邮箱
 * @return {status}
 */
router.post("/api/addGuestbook", (req, res) => {
  let ip = req.headers["x-real-ip"],
    { id, content, user_name, email, city, avatar, reply_user } = req.body;
  debugger
  if (!content) {
    errorCallback(res, "留言内容不能为空！");
  } else {
    let data = Object.assign(
        {
          ip: ip,
          content: content,
          user_name: user_name,
          email: email,
          city: city,
          avatar: avatar,
          creation_at: Date.parse(new Date())
        },
        reply_user ? { reply_id: id, reply_user: reply_user } : {}
      ),
      guestbook = new db.Guestbook(data);

    guestbook.save((err, result) => {
      if (!err) {
        if (reply_user) {
          db.Guestbook.updateOne(
            { _id: id },
            {
              $addToSet: {
                replys: result._id
              }
            },
            err => {
              callback(err, res, result, result, ["回复成功", "回复失败"]);
            }
          );
        } else {
          callback(err, res, result, result, ["留言成功", "留言失败"]);
        }
      } else {
        errorCallback(res, "留言失败");
      }
    });
  }
});

/**
 * 发表评论
 * @param {String} id - 文章id或评论id
 * @param {String} content - 内容
 * @param {String} user_name - 昵称
 * @param {String} city - 城市信息
 * @param {String} avatar - 头像
 * @param {String} reply_user - 评论用户
 * @param {String}  email - 邮箱
 * @return {status}
 */
router.post("/api/addComment", (req, res) => {
  let ip = req.headers["x-real-ip"],
    { id, content, user_name, email, city, avatar, reply_user } = req.body;

  if (!content) {
    errorCallback(res, "评论内容不能为空！");
  } else {
    let data = Object.assign(
        {
          ip: ip,
          content: content,
          user_name: user_name,
          email: email,
          city: city,
          avatar: avatar,
          creation_at: Date.parse(new Date())
        },
        reply_user
          ? { reply_id: id, reply_user: reply_user }
          : { article_id: id }
      ),
      comment = new db.Comment(data);

    comment.save((err, result) => {
      if (!err) {
        if (reply_user) {
          db.Comment.update(
            { _id: id },
            {
              $addToSet: {
                replys: result._id
              }
            },
            error => {
              callback(error, res, result, result, ["回复成功", "回复失败"]);
            }
          );
        } else {
          db.Article.update(
            { _id: id },
            {
              $addToSet: {
                comments: result._id
              }
            },
            error => {
              callback(error, res, result, result, ["评论成功", "评论失败"]);
            }
          );
        }
      }
    });
  }
});

/**
 * 评论头像上传
 * @return {status}
 */
router.post("/api/avatarUpload", (req, res, next) => {
  // 七牛相关配置信息
  common.qn_config.bucket = "avatar";
  let client = qn.create(common.qn_config);

  // 上传单个文件
  upload.single("file")(req, res, err => {
    if (err) {
      return console.error(err);
    }

    if (req.file && req.file.buffer) {
      let file_name = req.file.originalname + "-" + Date.now();

      // 上传到七牛
      client.upload(
        req.file.buffer,
        {
          key: file_name
        },
        (err, result) => {
          callback(err, res, result, { avatar: file_name }, [
            "上传成功",
            "上传失败"
          ]);
        }
      );
    }
  });
});

/**
 * 七牛图片上传
 * @return {status}
 */
router.post("/api/upload", (req, res, next) => {
  // 七牛相关配置信息
  let client = qn.create(common.qn_config);

  // 上传单个文件
  upload.single("file")(req, res, err => {
    if (err) {
      return console.error(err);
    }
    if (req.file && req.file.buffer) {
      // 上传到七牛
      client.upload(
        req.file.buffer,
        {
          key: req.file.originalname
        },
        (err, result) => {
          callback(err, res, result, {}, ["上传成功", "上传失败"]);
        }
      );
    }
  });
});

/**
 * 获取七牛资源列表
 * @param {prefix}   文件前缀
 * @param {limit}    返回的最大文件数量
 * @param {type}     区分是否添加指定目录分隔符。  默认为false
 */
router.post("/api/getQiniuList", (req, res) => {
  bucketManager.listPrefix(
    bucket,
    {},
    (err, respBody, respInfo) => {

      respBody.items.reverse().forEach((item, i) => {
        respBody.items[i].img_name = item.key;
      });

      callback(err, res, respInfo, respBody, ["获取资源成功", respBody, err]);
    }
  );
});

/**
 * 删除七牛对应空间中的文件
 * @param {key} 文件名
 */
router.post("/api/delete_qiniu", (req, res) => {
  bucketManager.delete(bucket, req.body.img_name, (err, respBody, respInfo) => {
    callback(err, res, respInfo, respBody, ["删除成功", respBody, err]);
  })
})

/**
 * 登录验证
 * @param {token}   token
 * @return {status}
 */
router.post("/api/isLogin", (req, res) => {
  db.User.findOne({ token: req.body.token }, (err, result) => {
    callback(err, res, result, {}, ["获取成功", "用户不存在"]);
  });
});

/**
 * 登录
 * @param {username}    用户名
 * @param {password}    密码
 * @return {status}
 */
router.post("/api/login", (req, res) => {
  db.User.findOne(
    { username: req.body.username, password: req.body.password },
    (err, result) => {
      let token = result ? result.token : null
      callback(err, res, result, { token: token }, [
        "登录成功",
        "账号或密码不正确"
      ]);
    }
  );
});

module.exports = router;