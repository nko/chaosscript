$(document).ready(function() {
    $('.preview').remove();
    $('.opened-dir').removeClass('opened-dir').addClass('closed-dir');
    $('.video').hide();
    
    $('.filetree a').bind('click', function() {
        var e = $(this);
        var p = e.parent();
        if (p.hasClass('filemenu'))
            return true;
        if (p.hasClass('opened-dir') || p.hasClass('closed-dir')) {
            p.children('ul').slideToggle('slow');
            p.toggleClass('opened-dir').toggleClass('closed-dir');
        }
//        $('.filetree a').removeClass('selected');
//        e.addClass('selected');
        return false;
    });
    
    
    $('.filetree li').bind('click', function() {
        $(this).children('a').click();
        return false;
    });

    var m;
    if ((m = document.location.pathname.match(/\/([0-9a-f]{40})\./)))
	pollInfo(m[1]);
});

var downloadedBefore, lastPoll;
function pollInfo(infoHex) {
    $.ajax({ url: '/' + infoHex + '.json',
	     dataType: 'json',
	     success: function(info) {
		 var now = Date.now();
		 var s = (info.peers.connected || 0) + '/' +
		     (info.peers.total || 0) + ' peers connected';
		 if (downloadedBefore && lastPoll) {
		     var rate = Math.round((info.downloaded - downloadedBefore) /
					   (now - lastPoll));
		     if (isNaN(rate) || rate < 0)
			 rate = 0;
		     s += ', leeching with ' + rate + ' KB/s';
		 }
		 $('.metainfos').text(s);

		 lastPoll = now;
		 downloadedBefore = info.downloaded;

		 pollInfo(infoHex);
	     },
	     error: function() {
		 setTimeout(function() {
				pollInfo(infoHex);
			    }, 1000);
	     }
	   });
}

function showVideo( ele, path, mime ) {
    path = unescape(path);
    var w = '560';
    var h = '340';
    
    mp4arr = ['video/x-matroska', 'video/divx', 'video/x-matroska', 'video/mp4'];
    qtarr = ['video/quicktime'];
    
    if (jQuery.inArray(mime, mp4arr) != -1)
        inp = '<object classid="clsid:67DABFBF-D0AB-41fa-9C46-CC0F21721616" width="'+w+'" height="'+h+'" codebase="http://go.divx.com/plugin/DivXBrowserPlugin.cab"><param name="src" value="'+path+'" /><embed type="'+mime+'" src="'+path+'" width="'+w+'" height="'+h+'" pluginspage="http://go.divx.com/plugin/download/"></embed></object>';
    else if (jQuery.inArray(mime, qtarr) != -1)
        inp = '<OBJECT classid="clsid:02BF25D5-8C17-4B23-BC80-D3488ABDDC6B" width="'+w+'" height="'+h+'" codebase="http://www.apple.com/qtactivex/qtplugin.cab"><param name="src" value="'+path+'"><EMBED src="'+path+'" width="'+w+'" height="'+h+'" pluginspage="http://www.apple.com/quicktime/download/"></EMBED></OBJECT>';
    else
        inp = '<video width="'+w+'" height="'+h+'" controls autobuffer autoplay><source src="'+path+'" type="'+mime+'" />This browser is not compatible with HTML 5 or the given codec.</video>';
    
    return showPreview( ele, '<div class="preview">'+inp+'</div>');
}


function showText( ele, path ) {
    path = unescape(path);
    return showPreview( ele, '<div class="preview"><iframe src="'+path+'">Sorry, no iframe for you</iframe></div>');
}


function showImage( ele, path ) {
    path = unescape(path);
    return showPreview( ele, '<div class="preview"><img src="'+path+'" alt="picture is loading..."></div>');
}


function showAudio( ele, path ) {
    path = unescape(path);
    return showPreview( ele, '<div class="preview"><audio controls autobuffer autoplay><source src="'+path+'"></audio></div>' );
}

/*function showunknown( ele, path ) {
    path = unescape(path);
    return showPreview( ele, '<div class="preview"><input value="'+path+'" size="40" readonly></div>' );    
}
*/

function showPreview( ele, content ) {
    $('.preview').remove();
    if ($(ele).hasClass('active'))
         $(ele).text('View');
    else {
        $(ele).parent().parent().append($(content).hide()).find("div.preview").slideDown('slow');
        $(ele).text('Close');
    }
    $(ele).toggleClass('active');
    return false;
}
