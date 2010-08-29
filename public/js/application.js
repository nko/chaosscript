$(document).ready(function() {
    $('.preview').remove();
    $('.opened-dir').removeClass('opened-dir').addClass('closed-dir');
    $('.filemenu').hide();
    $('.video').hide();
    
    $('.filetree a').bind('click', function() {
        $('.filemenu').hide();
        var e = $(this);
        var p = e.parent();
        if (p.hasClass('opened-dir') || p.hasClass('closed-dir'))
            p.toggleClass('opened-dir').toggleClass('closed-dir');
        else if (p.hasClass('file'))
            e.next().toggle(); // filemenu
        $('.filetree a').removeClass('selected');
        e.addClass('selected');
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

function showVideo( ele, path ) {
    path = unescape(path);
    return showPreview( ele, '<div class="preview video"><video width="560" height="340" controls><source src="'+path+'" type=\'video/mp4; codecs="avc1.42E01E, mp4a.40.2"\'><source src="'+path+'" type=\'video/ogg; codecs="theora, vorbis"\'><object width="640" height="384" type="application/x-shockwave-flash" data="'+path+'"><param name="movie" value="'+path+'" /></object></video></div>');
}


function showText( ele, path ) {
    path = unescape(path);
    return showPreview( ele, '<div class="preview"><iframe src="'+path+'">Sorry, no iframe for you</iframe></div>');
}


function showGraphic( ele, path ) {
    path = unescape(path);
    return showPreview( ele, '<div class="preview"><img src="'+path+'" alt="picture is loading..."></div>');
}


function showPreview( ele, content ) {
    $('.preview').remove();
    if ($(ele).hasClass('active'))
         $(ele).text('View');
    else {
        $(ele).parent().parent().append(content);
        $(ele).text('Close');
    }
    $(ele).toggleClass('active');
    return false;
}
