var template = '';
module.exports = {
    setTemplate: function( templatePath ) {
        require('fs').readFile(templatePath, function (err, data) {
            if (err) throw err;
            template = data;
        });
    },
    show: function( filelist ) {
      var someContent = this.tag('div', {'class':'metainfos'}, 'this is a test');
      someContent += this.tag('ul', {'class':'filetree'}, filelist);
      someContent += this.tag('p',{'class':'bottom'},'');
      this.fillWith( someContent );
      return template;
    },
    index: function( torrents ) {
      var someContent = this.tag( 'input', { 'name':'torrentfile',
                                             'type':'file',
                                             'class': 'fileinput'});
      someContent += this.tag('input',{'type':'submit'});
      someContent = this.tag( 'form', { 'action':'/up',
                                        'method':'post',
                                        'enctype':'multipart/form-data',
                                        'class':'uploadform'},
                                     someContent);
      var helpUsMsg = 'Help us win Node.js KO!';
      var img = this.tag( 'img', { 'src':'http://nodeknockout.com/images/voteko.png',
                                    'alt':helpUsMsg});
      someContent += this.tag( 'a', { 'href':'http://nodeknockout.com/teams/chaosscript',
                                      'target':'nko',
                                      'title':helpUsMsg,
                                      'class':'pleasevote' },
                                   img);
      someContent += this.tag('ul', {'class':'left'}, torrents);
      someContent += this.tag('div', {'class':'right'}, this.tag('p',[],'Lorem ipsum'));
      someContent += this.tag('p',{'class':'bottom'},'');
      this.fillWith( someContent );
      
      return template;
    },
    get: function() {
      return template;
    },
    tag: function( tagName, opts, content ) {
        if (typeof(content)=='undefined')
            return '<'+tagName+' '+this.optsToStr(opts)+' />';
        else
            return '<'+tagName+' '+this.optsToStr(opts)+'>'+content+'</'+tagName+'>';
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

