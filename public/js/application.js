$(document).ready(function() {
    $('.video').hide();
    $('.opened-dir').removeClass('opened-dir').addClass('closed-dir');
    $('.filemenu').hide();
    $('.video').hide();
    
    $('.filetree a').bind('click', function() {
      var e = $(this);
      var p = e.parent();
      if (p.hasClass('opened-dir') || p.hasClass('closed-dir'))
      {
        p.toggleClass('opened-dir').toggleClass('closed-dir');
      } else if (p.hasClass('file'))
      {
        e.next().toggle();
      }
      if (e.hasClass('selected'))
      {
        $('.filetree a').removeClass('selected');
      } else {
        $('.filetree a').removeClass('selected');
        e.addClass('selected');
      }
      return false;
    });
    
    $('.viewmovie').bind('click', function() {
      $('.video').remove();
      if ($(this).hasClass('active'))
      {
         $(this).text('View');
      } else {
         $(this).parent().parent().append('<div class="video"><video width="560" height="340" controls><source src="somevideo.mp4" type=\'video/mp4; codecs="avc1.42E01E, mp4a.40.2"\'><source src="somevideo.ogv" type=\'video/ogg; codecs="theora, vorbis"\'><object width="640" height="384" type="application/x-shockwave-flash" data="somevideo.bla"><param name="movie" value="somevideo.bla" /></object></video></div>');
         $(this).text('Close');
     }
     $(this).toggleClass('active');
    });
});