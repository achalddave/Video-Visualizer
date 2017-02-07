function predictionScoreId(label) {
  return 'prediction-score-' + label.replace(/[ \/]/, '-');
}
function groundtruthLabelId(label) {
  return 'groundtruth-label-' + label.replace(/[ \/]/g, '-');
}

function addLabel(label) {
  var groundtruthLabelDiv = $('<div/>')
                                .addClass('label')
                                .attr('id', groundtruthLabelId(label))
                                .text(label);
  var predictionsLabelDiv = $('<div/>')
                                .addClass('label')
                                .attr('id', 'prediction-label-' + label)
  var predictionsScore = $('<span/>')
                             .addClass('prediction-score')
                             .attr('id', predictionScoreId(label))
                             .data('score', 0.0);
  predictionsLabelDiv.append(predictionsScore);
  $('#groundtruth-labels').append(groundtruthLabelDiv);
  $('#predictions-scores').append(predictionsLabelDiv);

  predictionsScore.on('newScore', function() {
    var $this = $(this);
    var score = $(this).data('score');
    $this.text(score.toFixed(2));
    var lightness = Math.round((1 - score) * 255);
    $this.parent().css(
        'background',
        'rgb(' + lightness + ', ' + lightness + ', ' + lightness + ')');
    if (lightness < 128) {
      $this.css('color', 'white');
    } else {
      $this.css('color', 'black');
    }
  });
  predictionsScore.trigger('newScore');
}

function activateLabel(label) {
  $('#' + groundtruthLabelId(label)).addClass('active-label');
}

function deactivateLabel(label) {
  $('#' + groundtruthLabelId(label)).removeClass('active-label');
}

function updateScores(scores) {
  /* Update prediction score for each label at the current time.
   *
   * @param {object} scores Map label name to current score.
   */
  for (var label in scores) {
    $('#' + predictionScoreId(label))
        .data('score', scores[label])
        .trigger('newScore');
  }
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

// TODO(achald): Implement this.
// function groundtruthToBinaryArrays(groundtruth, videoLength, numFrames) {
//   /*
//    * @param {Array} groundtruth Array of objects containing fields .start, .end,
//    *     .label, sorted by start time and then by end time.
//    * @param {float} videoLength Length of video in seconds.
//    * @param {int} numFrames Number of frames to output binary array for.
//    *
//    * @returns {object} Maps label to a binary array of length numFrames.
//    */
//   var labelArrays = {};
//   // TODO(achald): Implement this.
// }

function getUniqueLabels(groundtruth) {
  /* Get list of unique labels from groundtruth.
   *
   * @returns {Array} Sorted list of labels.
   */
  var labels = {};
  groundtruth.forEach(function(x) { labels[x.label] = 1; });
  labels = Object.keys(labels);
  return labels;
}

function loadVideo(video) {
  // Array of objects containing fields .start, .end, .label sorted by start
  // time and then by end time.
  var allGroundtruth = null;
  // Object mapping label to array of prediction scores for each frame.
  var allPredictions = null;
  var nextStart = 0;
  var videoLength = null;  // Video length in seconds
  var groundtruthLabels = null;
  var numFrames = null;

  $('#predictions-scores').html('');
  $('#groundtruth-labels').html('');
  $('#predictions-graph').html('');

  $('video').attr('src', 'video/' + video);
  $('video').on('loadeddata', function() {
    videoLength = $(this)[0].duration;
  });

  $('#debug').text('Loading groundtruth and predictions...');
  $.when($.get('/groundtruth/' + video), $.get('/predictions/' + video)).then(
    function(groundtruthResponse, predictionsResponse) {
      $('#debug').text('');
      allGroundtruth = normalizeGroundtruth(groundtruthResponse[0]);
      allPredictions = predictionsResponse[0];
      numFrames = allPredictions[Object.keys(allPredictions)[0]].length;

      groundtruthLabels = getUniqueLabels(allGroundtruth);
      groundtruthLabels.sort();
      groundtruthLabels.forEach(function(label) { addLabel(label); });

      var heatmapValues = [];
      for (var label in allPredictions) {
        heatmapValues.push(allPredictions[label]);
      }
      var data = [{z: heatmapValues, type: 'heatmap', colorscale: 'Greys'}];
      var layout = {title: 'Predictions'};
      Plotly.newPlot('predictions-graph', data, layout, {linkText: 'hi'});
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

    // Update prediction scores for current frame.
    var frame = Math.round(time * numFrames / videoLength);
    var scores = {}
    groundtruthLabels.forEach(function(label) {
      scores[label] = allPredictions[label][frame];
    })
    updateScores(scores);

    // Find which groundtruths are active.
    for (var i = nextStart; i < allGroundtruth.length; ++i) {
      var currentGroundtruth = allGroundtruth[i];
      if (currentGroundtruth.start >= time) {
        break;
      }
      if (currentGroundtruth.end <= time) {
        if (i == nextStart) { nextStart++; }
        deactivateLabel(currentGroundtruth.label);
        continue;
      }
      activateLabel(currentGroundtruth.label);
    }
  });
  $('video').on('seeked', function() {
    nextStart = 0;
    groundtruthLabels.forEach(function(label) { deactivateLabel(label); });
  });
}

$(function() {
  // Populate video options:
  $.get('/video_list', function(videoList) {
    var options = [];
    videoList.forEach(function(videoName) {
      options.push(
          '<option value="' + videoName + '">' + videoName + '</option>');
    });
    $('#video-selector').html(options.join(''));
    $('#video-selector').val('video_validation_0000153').change();
  });
  $('#video-selector').change(function() {
    loadVideo($(this).val());
  });
});
