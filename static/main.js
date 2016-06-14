var allGroundtruth = null;
var allPredictions = null;
var nextStart = 0;
var activeLabels = {}

function addLabel(label) {
  var labelDiv =
      $("<div/>").addClass('label').attr('id', 'label-' + label).text(label);
  $('#groundtruth').append(labelDiv);
}

function activateLabel(label) {
  activeLabels[label] = 1;
  $('#label-' + label).addClass('active-label');
}

function deactivateLabel(label) {
  delete activeLabels[label];
  $('#label-' + label).removeClass('active-label');
}

function loadVideo(video) {
  allGroundtruth = null;
  allPredictions = null;
  nextStart = 0;
  activeLabels = {};

  $('video').attr('src', 'video/' + video);
  $.get('/groundtruth/' + video, function(receivedGroundtruth) {
     // receivedGroundtruth is an array of arrays of the form
     // (startSec, endSec, label)
     allGroundtruth = [];
     receivedGroundtruth.forEach(function(x) {
       allGroundtruth.push({'start': x[0], 'end': x[1], 'label': x[2]});
     });
     // Sort by start seconds, and then by end seconds.
     allGroundtruth.sort(function(a, b) {
       var startDiff = a.start - b.start;
       if (startDiff != 0) {
         return startDiff;
       } else {
         return a.end - b.end
       }
     });

     var labels = {};
     allGroundtruth.forEach(function(x) { labels[x.label] = 1; });
     labels = Object.keys(labels);
     labels.sort();
     labels.forEach(function(label) { addLabel(label); });
   });

  $('video').bind('timeupdate', function() {
    $('#debug').text('');
    if (allGroundtruth == null) {
      return;
    }
    var time = $(this)[0].currentTime;
    for (var i = nextStart; i < allGroundtruth.length; ++i) {
      var currentGroundtruth = allGroundtruth[i];
      if (currentGroundtruth.start >= time) {
        break;
      }
      if (currentGroundtruth.end <= time) {
        if (i == nextStart) { nextStart++; }
        deactivateLabel(currentGroundtruth.label);
        console.log('Deactivating', currentGroundtruth);
        continue;
      }
      console.log('Activating', currentGroundtruth);
      activateLabel(currentGroundtruth.label);
      $('#debug').text($('#debug').text() +
                       '(' + currentGroundtruth.start + ', ' +
                         + currentGroundtruth.end + ', '
                         + currentGroundtruth.label + '); ');
    }
  });
}

$(function() {
  var videoName = 'video_validation_0000910.mp4';
  loadVideo(videoName);
})
