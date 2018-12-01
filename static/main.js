function addBreakCharacters(label) {
  // Add control characters allowing the label to be broken into multiple lines.
  return label.replace(/[\/]/g, '/\u200B');
}
function escapeLabel(label) {
  return label.replace(/[ \/]/g, '-');
}
function predictionScoreId(label) {
  return 'prediction-score-' + escapeLabel(label);
}
function predictionGraphId(label) {
  return 'prediction-graph-' + escapeLabel(label);
}
function groundtruthLabelId(label) {
  return 'groundtruth-label-' + escapeLabel(label);
}

function addLabel(label, labelInVideo) {
  /* Add label row to groundtruth / predictions table in UI.
   *
   * @param {string} label Name of label.
   * @param {bool} labelInVideo Indicates whether the label is in the
   *     groundtruth for current video.
   *
   */
  var groundtruthLabelDiv = $('<td>')
                                .addClass('label groundtruth-label')
                                .attr('id', groundtruthLabelId(label))
                                .html(addBreakCharacters(label));
  var predictionsLabelDiv = $('<td>')
                                .addClass('label prediction-label')
                                .attr('id', 'prediction-label-' + label);
  var predictionsScore = $('<span/>')
                             .addClass('prediction-score')
                             .attr('id', predictionScoreId(label))
                             .data('score', 0.0);
  predictionsLabelDiv.append(predictionsScore);
  var predictionsGraph =
      $('<td/>')
          .append($('<div/>').attr('id', predictionGraphId(label)))
          .addClass('prediction-score-graph');
  var toAddContainer =
      labelInVideo ? $('#labels-in-video') : $('#labels-not-in-video');
  toAddContainer.append(
      $('<tr>')
          .addClass('label-row')
          .append(groundtruthLabelDiv)
          .append(predictionsLabelDiv)
          .append(predictionsGraph));

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

function updateScores(allPredictions, frame) {
  /* Update prediction score for each label at the current time.
   *
   * @param {object} allPredictions Map label name to list of scores for each
   *     frame.
   * @param {number} frame Current frame index.
   */
  for (var label in allPredictions) {
    // There may be labels we aren't displaying, for which the following will
    // just be a no-op. We could optimize this by only running on labels that
    // are displayed, but it seems to be fast enough.
    predictionScoreDiv = $('#' + predictionScoreId(label));

    if (predictionScoreDiv.length == 0) { continue; }
    predictionScoreDiv.data('score', allPredictions[label][frame])
        .trigger('newScore');

    Plotly.relayout(predictionGraphId(label), {
      shapes: [{
        type: 'line',
        x0: frame,
        y0: 0,
        x1: frame,
        y1: 1,
      }]
    });
  }


}

function drawGraphs(allPredictions, allGroundtruthBinary, framesPerSecond) {
  var numFrames = allPredictions[Object.keys(allPredictions)[0]].length;
  var frameRange = _.range(numFrames);
  var zeroGroundtruth = Array(numFrames).fill(0);
  // Ensure all graphs are the same width.
  var graphWidth = null;
  for (var label in allPredictions) {
    var labelGraphDiv = $('#' + predictionGraphId(label));
    if (labelGraphDiv.length == 0) { continue; }
    if (graphWidth == null) {
      graphWidth = labelGraphDiv.width();
    }
    var groundtruthData = label in allGroundtruthBinary ?
        allGroundtruthBinary[label] :
        zeroGroundtruth;
    var data = [
      {x: frameRange, y: allPredictions[label], name: 'Predictions'},
      {x: frameRange, y: groundtruthData, name: 'Groundtruth'}
    ];
    var predictionsLayout = {
      annotations: [],
      height: 50,
      width: graphWidth,
      margin: {r: 0, t: 0, b: 0, l: 0},
      xaxis: {
        range: [0, numFrames],
        showgrid: false,
        zeroline: false,
        showline: false,
        autotick: true,
        ticks: '',
        showticklabels: false
      },
      yaxis: {
        range: [0, 1.1],
        showgrid: true,
        zeroline: true,
        showline: false,
        autotick: true,
        ticks: '',
        showticklabels: false
      },
      showlegend: false
    };
    Plotly.newPlot(
      predictionGraphId(label), data, predictionsLayout, {displayModeBar: false});
    labelGraphDiv[0].on('plotly_click', function(data) {
      $('video')[0].currentTime = data.points[0].x / framesPerSecond;
    });
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
function groundtruthToBinaryArrays(groundtruth, framesPerSecond, numFrames) {
  /*
   * @param {Array} groundtruth Array of objects containing fields .start, .end,
   *     .label, sorted by start time and then by end time.
   * @param {number} framesPerSecond
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
  var framesPerSecond = null;

  $('.label-row').remove();
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
      framesPerSecond = numFrames / videoLength;

      var groundtruthLabelsSet = {};
      allGroundtruth.forEach(function(x) {
        groundtruthLabelsSet[x.label] = true;
      });
      groundtruthLabels = Object.keys(groundtruthLabelsSet);
      groundtruthLabels.sort();

      var labelsArray = [];
      for (var label in allPredictions) { labelsArray.push(label); }

      var heatmapValues = [];
      labelsArray.forEach(function(label) {
        heatmapValues.push(allPredictions[label]);
      });

      // Add labels sorted in descending order by mean prediction.
      var meanPredictions = {};
      for (var label in allPredictions) {
        var total = 0;
        allPredictions[label].forEach(function(score) { total += score; });
        meanPredictions[label] = total / allPredictions[label].length;
      }
      var sortedLabelsArray = labelsArray.slice();
      sortedLabelsArray.sort(function(a, b) {
        // Sort in descending order of mean prediction.
        return meanPredictions[a] > meanPredictions[b] ? -1 : 1;
      });
      sortedLabelsArray.forEach(function(label) {
        labelInVideo = groundtruthLabelsSet[label] == true;
        addLabel(label, labelInVideo);
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
      var groundtruthBinaryArrays = groundtruthToBinaryArrays(
          allGroundtruth, framesPerSecond, numFrames);
      drawGraphs(allPredictions, groundtruthBinaryArrays, framesPerSecond);
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
        updateScores(allPredictions, frame);

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
