var template = '';
module.exports = {
    setTemplate: function( templatePath ) {
        require('fs').readFile(templatePath, function (err, data) {
        if (err) throw err;
        template = data;
        });
    },
    show: function() {
      return template;
    },
    tag: function( tagName, opts, content ) {
        if (typeof(opts)=='undefined')
            return '<'+tagName+' '+this.optsToStr(opts)+' />';
        else
            return '<'+tagName+' '+this.optsToStr(opts)+'>'+content+'</'+tagName+'>';
    },
    optsToStr: function( opts ) {
        var result = '';
        if (!(typeof(opts)=='undefined'))
            for (var key in opts)
                result = result + ' ' + key + '="'+ opts +'"';
        return result;
    },
    fillWith: function( content, placeholder ) {
        if (typeof(placeholder)=='undefined')
            var placeholder = '%CONTENT%';
        return template = (template+'').replace( placeholder, content );
    }
};

