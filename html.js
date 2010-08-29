var DESCRIPTION = 'Bitsuckr serves as a bridge between shiny HTML5 audio/video features and ' +
    'the best crowd-sourced media repository on the Internet. ' +
    'It\'s the <a href="http://nodeknockout.com">NodeKnockout</a> submission by ' +
    '<a href="http://spaceboyz.net/~astro/">Astro</a> and Alexander Adam. ' +
    'Node.js is put to real work here, it deals with all the BitTorrent traffic.<br>' +
    'BTW, Astro is looking for a diploma thesis very soon.';
var template = '';
module.exports = {
    setTemplate: function( templatePath ) {
        require('fs').readFile(templatePath, function (err, data) {
            if (err) throw err;
            template = data;
        });
    },
    show: function( files ) {
        var M = module.exports;
        var someContent = M.tag('div', {'class':'metainfos'}, 'Stinging the swarm...');
        var filelist = M.generateFilelist( files );
        someContent += M.tag('ul', {'class':'filetree'}, filelist);
        someContent += M.tag('p',{'class':'bottom'},'');
        return M.fillWith( someContent );
    },
    index: function( torrents ) {
        var M = module.exports;
        var someContent = M.tag( 'label', { for: 'fileinput' }, 'Stream a .torrent file' );
        someContent += M.tag( 'input', {    'name':'torrentfile',
                                            'id':'fileinput',
                                            'type':'file',
                                            'class': 'fileinput'});
        someContent += M.tag('input', {'type':'submit', 'value':'Ok'});
        someContent = M.tag( 'form', { action:'/up',
                                        method:'post',
                                        enctype:'multipart/form-data',
                                        'class':'uploadform'},
                                     someContent);
        var helpUsMsg = 'Help us win Node.js KO!';
        var img = M.tag( 'img', { 'src':'http://nodeknockout.com/images/voteko.png',
                                  'alt':helpUsMsg});
        someContent += M.tag( 'a', { 'href':'http://nodeknockout.com/teams/chaosscript',
                                      'target':'nko',
                                      'title':helpUsMsg,
                                      'class':'pleasevote' },
                                   img);
        someContent += M.tag('ul', {'class':'left torrents'}, torrents);
        someContent += M.tag('div', {'class':'right'}, M.tag('p',[], DESCRIPTION));
        someContent += M.tag('p',{'class':'bottom'},'');
        return M.fillWith( someContent );
    },
    get: function() {
        return template;
    },
    tag: function( tagName, opts, content ) {
        var M = module.exports;
        if (typeof(content)=='undefined')
            return '<'+tagName+' '+M.optsToStr(opts)+' />';
        else
            return '<'+tagName+' '+M.optsToStr(opts)+'>'+content+'</'+tagName+'>';
    },
    optsToStr: function( opts ) {
        var result = '';
        if (!(typeof(opts)=='undefined'))
            for (var key in opts)
                result += ' ' + key + '="'+ opts[key] +'"';
        return result;
    },
    fillWith: function( content, placeholder ) {
        if (typeof(placeholder)=='undefined')
            var placeholder = '%CONTENT%';
        return (template+'').replace( placeholder, content );
    },
    generateFilelist: function( files ) {
        var M = module.exports;
        var fList = '';
        for (var filename in files) {
            var file = files[filename];
            var cont = (file['kind'] == 'unknown') ? M.tag('span',{},filename) : M.tag('a',{'href':'#'},filename);
            if (file['type'] == 'file') { // File
//                console.log(filename +' is a file');
                cont += M.filemenuFor(file);
                fList += M.tag('li',{'class':'file'}, cont);
            } else { // Directory
                cont += M.tag('ul',{}, M.generateFilelist(file['files']));
                fList += M.tag('li',{'class':'opened-dir'}, cont );
            }
        }
        return fList;
    },
    filemenuFor: function( fileData ) {
        var M = module.exports;
        var method = 'show'+fileData['kind'];
        var r = '';
        var mime = '';
        if (fileData['kind'].toLowerCase() == 'video') {
            var p = fileData['path'].toLowerCase();
            console.log(p);
            if ((p.indexOf('xvid') == -1) && (p.indexOf('divx') == -1))
                mime = ", '"+fileData['mime']+"'";
            else
                mime = ", 'video/divx'";
        }
	if (fileData.kind !== 'unknown')
            r += M.tag('a',{href:'#',
                            onclick:'return '+method+"(this, '/"+escape(fileData['path'])+"'"+mime+");",
                            'class':'viewmovie'},'View');
        r += M.tag('a',{href:'/'+fileData['path']},'Download');
        return M.tag('div', {'class':'filemenu'}, r);
    }

};

