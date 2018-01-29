function addBreakCharacters(label) {
  // Add control characters allowing the label to be broken into multiple lines.
  return label.replace(/[\/]/g, '/\u200B');
}
function predictionScoreId(label) {
  return 'prediction-score-' + label.replace(/[ \/]/g, '-');
}
function groundtruthLabelId(label) {
  return 'groundtruth-label-' + label.replace(/[ \/]/g, '-');
}

function addLabel(label) {
  var groundtruthLabelDiv = $('<td>')
                                .addClass('label')
                                .attr('id', groundtruthLabelId(label))
                                .html(addBreakCharacters(label));
  var predictionsLabelDiv = $('<td>')
                                .addClass('label')
                                .attr('id', 'prediction-label-' + label);
  var predictionsScore = $('<span/>')
                             .addClass('prediction-score')
                             .attr('id', predictionScoreId(label))
                             .data('score', 0.0);
  predictionsLabelDiv.append(predictionsScore);
  $('#realtime-labels')
      .append(
          $('<tr>').append(groundtruthLabelDiv).append(predictionsLabelDiv));

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

function processGroundtruth(receivedGroundtruth) {
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
      return a.end - b.end;
    }
  });
  return groundtruth;
}

// TODO(achald): Implement this.
function groundtruthToBinaryArrays(groundtruth, videoLength, numFrames) {
  /*
   * @param {Array} groundtruth Array of objects containing fields .start, .end,
   *     .label, sorted by start time and then by end time.
   * @param {float} videoLength Length of video in seconds.
   * @param {int} numFrames Number of frames to output binary array for.
   *
   * @returns {object} Maps label to a binary array of length numFrames.
   */
  var groundtruthByLabel = {};
  groundtruth.forEach(function(x) {
    if (x.label in groundtruthByLabel) {
      groundtruthByLabel[x.label].push(x);
    } else {
      groundtruthByLabel[x.label] = [x];
    }
  });

  var framesPerSecond = numFrames / videoLength;

  var labelArrays = {};
  for (var label in groundtruthByLabel) {
    var currGroundtruth = groundtruthByLabel[label];
    labelArrays[label] = new Array(numFrames);
    for (var i = 0; i < numFrames; ++i) { labelArrays[label][i] = 0; }
    var nextStart = 0;
    for (var frame = 0; frame < numFrames; ++frame) {
      var querySecond = frame / framesPerSecond;
      while (nextStart < currGroundtruth.length) {
        var annotation = currGroundtruth[nextStart];
        if (annotation.start <= querySecond && annotation.end >= querySecond) {
          labelArrays[label][frame] = 1;
          break;
        } else if (annotation.end < querySecond) {
          nextStart++;
        } else { // annotation.start > querySecond
          break;
        }
      }
    }
  }
  return labelArrays;
}

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
  $('#groundtruth-graph').html('');

  $('#debug').text('Loading groundtruth and predictions...');
  var groundtruthRequest = $.get('/groundtruth/' + video);
  var predictionsRequest = $.get('/predictions/' + video);

  $('video').attr('src', 'video/' + video);
  var videoDurationDeferred = $.Deferred();
  $('video').on('loadeddata', function() {
    videoDurationDeferred.resolve($(this)[0].duration);
  });

  $.when(videoDurationDeferred, groundtruthRequest, predictionsRequest).then(
    function(videoLength_, groundtruthResponse, predictionsResponse) {
      videoLength = videoLength_;
      $('#debug').text('');
      allGroundtruth = processGroundtruth(groundtruthResponse[0]);
      allPredictions = predictionsResponse[0];
      numFrames = allPredictions[Object.keys(allPredictions)[0]].length;

      groundtruthLabels = getUniqueLabels(allGroundtruth);
      groundtruthLabels.sort();
      groundtruthLabels.forEach(function(label) { addLabel(label); });

      var labelsArray = [];
      for (var label in allPredictions) { labelsArray.push(label); }

      var heatmapValues = [];
      labelsArray.forEach(function(label) {
        heatmapValues.push(allPredictions[label]);
      });
      var labelsText = [];
      for (var i = 0; i < heatmapValues.length; ++i) {
        labelsText.push([]);
        for (var j = 0; j < heatmapValues[i].length; ++j) {
          labelsText[i].push(labelsArray[i]);
        }
      }
      var predictionsData = [{
        z: heatmapValues,
        type: 'heatmap',
        colorscale: 'Greys',
        text: labelsText
      }];
      var predictionsLayout = {title: 'Predictions', annotations: []};
      Plotly.newPlot('predictions-graph', predictionsData, predictionsLayout);
      var groundtruthBinaryArrays =
          groundtruthToBinaryArrays(allGroundtruth, videoLength, numFrames);
      var groundtruthHeatmap = [];
      var zeroArray = new Array(numFrames);
      for (var i = 0; i < numFrames; ++i) { zeroArray[i] = 0; }
      labelsArray.forEach(function(label) {
        if (label in groundtruthBinaryArrays) {
          groundtruthHeatmap.push(groundtruthBinaryArrays[label]);
        } else {
          groundtruthHeatmap.push(zeroArray);
        }
      });
      console.log('Constructed heatmap');
      var groundtruthData = [{
        z: groundtruthHeatmap,
        type: 'heatmap',
        colorscale: 'Greys',
        text: labelsText
      }];
      var groundtruthLayout = {title: 'Groundtruth'};
      Plotly.newPlot('groundtruth-graph', groundtruthData, groundtruthLayout);

      $('video').off('timeupdate');
      $('video').on('timeupdate', function() {
        if (allGroundtruth == null) {
          return;
        }
        var time = $(this)[0].currentTime;

        // Update prediction scores for current frame.
        var frame = Math.round(time * numFrames / videoLength);
        var scores = {};
        groundtruthLabels.forEach(function(label) {
          scores[label] = allPredictions[label][frame];
        });
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
    },
    function() {  // Failed request
      $('#debug').text('Request for predictions or groundtruth failed.');
    }
  );

}

$(function() {
  $('#video-selector').change(function() {
    loadVideo($(this).val());
  });
  // Populate video options:
  $.get('/video_list', function(videoList) {
    var options = [];
    videoList.forEach(function(videoName) {
      options.push(
          '<option value="' + videoName + '">' + videoName + '</option>');
    });
    $('#video-selector').html(options.join(''));
    $('#video-selector').val(videoList[0]).change();
  });
});
