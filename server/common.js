const multer = require('multer');
const storage = multer.memoryStorage()

const qn_config = {
    accessKey: 'pBEBz12PmpPH7mUzbDQhtqZ2qwAPOYCxkS8YsPvK',
    secretKey: 'Cvf78HDLHFVfMegy7RGT9e2ECep1CiVEz4KqoMFW',
    bucket: 'images',
    uploadURL: 'http://up-z0.qiniup.com'
};

const upload = multer({
    storage: storage,
    limits: {
        fieldSize: 1024 // 限制文件在1MB以内
    },
    fileFilter: function(req, files, callback) {
        console.log(files)
        // 只允许上传jpg|png|jpeg|gif格式的文件
        var type = '|' + files.mimetype.slice(files.mimetype.lastIndexOf('/') + 1) + '|';
        var fileTypeValid = '|jpg|png|jpeg|gif|'.indexOf(type) !== -1;
        callback(null, !!fileTypeValid);
    }
});

module.exports = {
	getInitials: (code) => getInitials(code),
	qn_config,
	upload
};