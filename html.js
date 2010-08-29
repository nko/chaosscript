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
	someContent += M.tag( 'input', { 'name':'torrentfile',
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
        someContent += M.tag('div', {'class':'right'}, M.tag('p',[],'Lorem ipsum'));
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
        filelist = '';
        for (var filename in files) {
            var file = files[filename];
            var cont = M.tag('a',{'href':'#'},filename+'');
            if (file['type'] == 'file') { // File
                cont += M.filemenuFor(filename,file);
                filelist += M.tag('li',{'class':'file'}, cont);
            } else { // Directory
                cont += M.generateFilelist(file['files']);
                filelist += M.tag('li',{'class':'opened-dir'}, cont );
            }
        }
        return filelist;
    },
    filemenuFor: function( filename, fileData ) {
        var M = module.exports;
        var method = 'show'+fileData['kind'];
        var r = '';
        r += M.tag('a',{href:'#',
                        onclick:'return '+method+"('"+escape(filename)+"');",
                        'class':'viewmovie'},'View');
        r += M.tag('a',{href:'#'},'Url');
        return M.tag('div', {'class':'filemenu'}, r);
    }

};

