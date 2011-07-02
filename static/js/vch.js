
window.statusUpdate = function(infoObj, msg, yes) {
  console.log([infoObj, msg, yes]);
  var session = infoObj.session;
  var connected = infoObj.status == "connected";
  if (connected) {
    console.log("Connected");
    getData();
  } else {
    consoe.log("Not connected...uhoh");
  }
}

window.data = {
  me: null,
  friends: {},
  queue: []
};
window.visdata = {
  nodes: [],
  links: []
};

function getData() {
  FB.api(
    {
      method: 'fql.query',
      query: 'SELECT name, pic FROM profile WHERE id=' + FB.getSession().uid
    },
    function(response) {
      console.log(["name, pic", response]);
      var user = response[0];
      data.me = {id: FB.getSession().uid,
                 pic: user.pic,
                 name: user.name};
      visdata.nodes.push({name: data.me.name, group:1});

      FB.api("/me/friends", function(response) {
        console.log(["/me/friends", response]);
        _.each(response.data, function(responseObj) {
          var friendObj = {
            id: responseObj.id,
            name: responseObj.name,
            friends: []
          };
          data.friends[friendObj.id] = friendObj;
          data.queue.push(friendObj);
        });

        processNextData();
        processNextData();
      });
    }
  );
}


var processed = 0;
function processNextData() {
  processed++;
  //if (data.queue.length == 0) {
  if (processed >= 10) {
    drawVis();
    return;
  }
  var friendObj = data.queue.pop();
  if (friendObj == null) {
    throw "Popped null friendObj";
  }
  FB.api(
    {
      method: 'friends.getMutualFriends',
      target_uid: friendObj.id
    },
    function(response) {
      console.log(["got back friend response for ", friendObj.name, response]);
      _.each(response, function(mutualFriendId) {
        var mutualFriend = data.friends[mutualFriendId];
        friendObj.friends.push(mutualFriend);
      });
      setTimeout(processNextData, 10);
    }
  );
}

function drawVis() {
  console.log("We are done!");
  // Put into protovis form
  var idxLookup = {};
  var pos = 0;
  _.each(data.friends, function(friendObj) {
    pos++;
    friendObj.vispos = pos;
    visdata.nodes.push({
      name: friendObj.name,
      group: 2
    });
    visdata.links.push({
      source: 0,
      target: pos,
      value: 1
    });
  });

  _.each(data.friends, function(friendObj) {
    _.each(friendObj.friends, function(mutualFriendObj) {
      visdata.links.push({
        source: friendObj.vispos,
        target: mutualFriendObj.vispos,
        value: 2
      });
    });
  });

  console.log(["nodes", visdata.nodes, "links", visdata.links]);

  console.log(JSON.stringify(visdata));

  var w = $(window).width(),
      h = $(window).height(),
      fill = d3.scale.category20();

  var vis = d3.select("#chart")
    .append("svg:svg")
      .attr("width", w)
      .attr("height", h);

  var force = d3.layout.force()
      .charge(-120)
      .distance(30)
      .nodes(visdata.nodes)
      .links(visdata.links)
      .size([w, h])
      .start();

  var link = vis.selectAll("line.link")
      .data(visdata.links)
    .enter().append("svg:line")
      .attr("class", "link")
      .style("stroke", "#888")
      .style("stroke-width", function(d) { return Math.sqrt(d.value); })
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });

  var node = vis.selectAll("circle.node")
      .data(visdata.nodes)
    .enter().append("svg:circle")
      .attr("class", "node")
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      .attr("r", 5)
      .style("fill", function(d) { return fill(d.group); })
      .call(force.drag);

  node.append("svg:title")
      .text(function(d) { return d.name; });

  vis.style("opacity", 1e-6)
    .transition()
      .duration(1000)
      .style("opacity", 1);

  force.on("tick", function() {
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node.attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });
  });
}
