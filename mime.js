var types = {
    ogg: 'application/ogg',
    mp3: 'audio/mpeg',
    txt: 'text/plain',
    nfo: 'text/plain; charset="cp437"',
    pdf: 'application/pdf',
    svg: 'image/svg+xml',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    gif: 'image/gif',
    png: 'image/png',
    bmp: 'image/x-bmp',
    mpg: 'video/mpeg',
    mpeg: 'video/mpeg',
    mp2: 'video/mpeg',
    avi: 'video/x-msvideo',
    wmv: 'video/x-ms-wmv',
    wma: 'audio/x-ms-wma',
    aac: 'audio/aac',
    '3gp': 'audio/3gpp',
    mov: 'video/quicktime',
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    mkv: 'video/x-matroska',
    mks: 'video/x-matroska',
    mka: 'audio/x-matroska',
    asf: 'video/x-ms-asf',
    ogv: 'video/ogg',
    torrent: 'application/x-bittorrent'
};

module.exports = {
    fileType: function(path) {
        var ext = path.split('/').pop().split('.').pop();
        return types[ext] || 'binary/octet-stream';
    }
};
