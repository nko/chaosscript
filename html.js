var template = '';
module.exports = {
    setTemplate: function( templatePath ) {
        require('fs').readFile(templatePath, function (err, data) {
            if (err) throw err;
            template = data;
        });
    },
    show: function( filelist ) {
      var M = module.exports;
      var someContent = M.tag('div', {'class':'metainfos'}, 'M is a test');
      someContent += M.tag('ul', {'class':'filetree'}, filelist);
      someContent += M.tag('p',{'class':'bottom'},'');
      M.fillWith( someContent );
      return template;
    },
    index: function( torrents ) {
      var M = module.exports;
      var someContent = M.tag( 'input', { 'name':'torrentfile',
                                             'type':'file',
                                             'class': 'fileinput'});
      someContent += M.tag('input',{'type':'submit'});
      someContent = M.tag( 'form', { 'action':'/up',
                                        'method':'post',
                                        'enctype':'multipart/form-data',
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
      someContent += M.tag('ul', {'class':'left'}, torrents);
      someContent += M.tag('div', {'class':'right'}, M.tag('p',[],'Lorem ipsum'));
      someContent += M.tag('p',{'class':'bottom'},'');
      M.fillWith( someContent );
      
      return template;
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
        return template = (template+'').replace( placeholder, content );
    }
};

