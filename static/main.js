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

function normalizeGroundtruth(receivedGroundtruth) {
  /* Sort groundtruth by start and end times, and create annotation objects
   * from annotation arrays.
   *
   * @param {Array} receivedGroundtruth An array of arrays of the form
   *     (startSec, endSec, label)
   *
   * @return {Array} Array of objects containing fields .start, .end, .label,
   *     sorted by start time and then by end time.
   */
  var groundtruth = [];
  receivedGroundtruth.forEach(function(x) {
    groundtruth.push({'start': x[0], 'end': x[1], 'label': x[2]});
  });
  // Sort by start seconds, and then by end seconds.
  groundtruth.sort(function(a, b) {
    var startDiff = a.start - b.start;
    if (startDiff != 0) {
      return startDiff;
    } else {
      return a.end - b.end
    }
  });
  return groundtruth;
}

function getUniqueLabels(groundtruth) {
  var labels = {};
  groundtruth.forEach(function(x) { labels[x.label] = 1; });
  labels = Object.keys(labels);
  return labels;
}

function loadVideo(video) {
  allGroundtruth = null;
  allPredictions = null;
  nextStart = 0;
  activeLabels = {};

  $('video').attr('src', 'video/' + video);

  $.when($.get('/groundtruth/' + video), $.get('/predictions/' + video)).then(
    function(groundtruthResponse, predictionsResponse) {
      var receivedGroundtruth = groundtruthResponse[0];
      var receivedPredictions = predictionsResponse[0];

      allGroundtruth = normalizeGroundtruth(receivedGroundtruth);
      var labels = getUniqueLabels(allGroundtruth);
      labels.sort();
      labels.forEach(function(label) { addLabel(label); });

      var heatmapValues = []
      var text = [];
      for (var label in receivedPredictions) {
        heatmapValues.push(receivedPredictions[label]);
        var labelText = [];
        receivedPredictions[label].forEach(function(score, frame) {
          labelText.push(
              'Frame: ' + frame + '\n' +
              'Score: ' + score + '\n' +
              'Label: ' + label);
        });
        text.push(labelText);
      }
      var data = [
        {z: heatmapValues, text: text, type: 'heatmap', colorscale: 'Greys'}
      ];

      var layout = {title: 'Predictions'};
      Plotly.newPlot('groundtruth-graphs', data, layout, {linkText: 'hi'});
    },
    function() {  // Failed request
      $('#debug').text('Request for predictions or groundtruth failed.');
    });

  $('video').off('timeupdate');
  $('video').on('timeupdate', function() {
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
    }
  });

}

$(function() {
  var videoName = 'video_validation_0000910.mp4';
  loadVideo(videoName);
})
