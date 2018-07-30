
const flatten = function(items) {
  return items.reduce(function(flat, item) {
    return flat.concat(item);
  });
};

const round4 = function(n) {
  const N = Math.pow(10, 4);
  return Math.round(n * N) / N;
};

const modulo = function(i, n) {
  return ((i % n) + n) % n;
};

const encode = function(txt) {
  return btoa(encodeURIComponent(txt));
};

const decode = function(txt) {
  return decodeURIComponent(atob(txt));
};

const dFromWaypoint = function(waypoint) {
  return encode(waypoint.Description);
};

const nFromWaypoint = function(waypoint) {
  return encode(waypoint.Name);
};

const gFromWaypoint = function(waypoint, cgs) {
  const cg_name = waypoint.Group;
  return index_name(cgs, cg_name);
};
const vFromWaypoint = function(waypoint) {
  return [
    waypoint.Zoom,
    waypoint.Pan[0],
    waypoint.Pan[1],
  ];
};
const oFromWaypoint = function(waypoint) {
  return [
    waypoint.Overlay.x,
    waypoint.Overlay.y,
    waypoint.Overlay.width,
    waypoint.Overlay.height,
  ];
};

const classOrNot = function(selector, condition, cls) {
  if (condition) {
    return $(selector).addClass(cls);
  }
  return $(selector).removeClass(cls);
};

const newMarkers = function(tileSources, group) {
  for (var property in tileSources) {
    if (tileSources.hasOwnProperty(property)) {
      if (property === group.Path) {
        for (var i=0; i<tileSources[property].length; i++) {
          const tileSource = tileSources[property][i];
          tileSource.setOpacity(1);
        }
        $('#' + property).parent().addClass('active');
      } else {
        for (var i=0; i<tileSources[property].length; i++) {
          const tileSource = tileSources[property][i];
          tileSource.setOpacity(0);
        }
        $('#' + property).parent().removeClass('active');
      }
    }
  }
};

const unpackGrid = function(layout, images, key='Grid') {
  const image_map = images.reduce(function(o, i) {

    i.TileSize = i.TileSize || [1024, 1024];
    i.maxLevel = i.maxLevel || 0;

    // Add to dictionary by Name
    o[i.Name] = i;

    return o;
  }, {});

  return layout[key].map(function(row) {
    return row.map(function(image_name) {
      return this.image_map[image_name];
    }, {image_map: image_map});
  }, {image_map: image_map});
};

const deepCopy = function(o) {
  var output, v, key;
  output = Array.isArray(o) ? [] : {};
  for (key in o) {
    v = o[key];
    output[key] = (typeof v === 'object') ? deepCopy(v) : v;
  }
  return output;
};

const serialize = function(keys, state, delimit) {
  return keys.reduce(function(h, k) {
    var value = state[k] || 0;
    // Array separated by underscore
    if (value.constructor === Array) {
      value = value.join('_');
    }
    return h + delimit + k + '=' + value;
  }, '').slice(1);

};

const deserialize = function(entries) {
  const query = entries.reduce(function(o, entry) {
    if (entry) {
      const kv = entry.split('=');
      const val = kv.slice(1).join('=') || '1';
      const vals = val.split('_');
      const key = kv[0];
      // Handle arrays or scalars
      o[key] = vals.length > 1? vals: val;
    }
    return o;
  }, {});

  return query;
};

const HashState = function(viewer, tileSources, exhibit) {

  this.showdown = new showdown.Converter();
  this.tileSources = tileSources;
  this.exhibit = exhibit;
  this.viewer = viewer;

  this.hashable = {
    exhibit: [
      's', 'w', 'g', 'v'
    ],
    tag: [
      'd', 'o', 'g', 'v'
    ]
  };

  this.state = {
    changed: false,
    design: {},
    w: [0],
    g: 0,
    s: 0,
    v: [1, 0.5, 0.5],
    o: [0, 0, 1, 1],
    description: '',
    name: '',
  };

  this.newExhibit();
};

HashState.prototype = {

  init() {
    // Read hash
    window.onpopstate = this.popState.bind(this);
    window.onpopstate();
    this.pushState();

    $('.group-tab').click(this, function(e) {
      const THIS = e.data;
      THIS.g = this.dataset.g;
      THIS.pushState();
    }); 

    // back and forward
    $('#step-back').click(this, function(e) {
      const THIS = e.data;
      THIS.w -= 1;
      THIS.pushState();
    });
    $('#step-next').click(this, function(e) {
      const THIS = e.data;
      THIS.w += 1;
      THIS.pushState();
    });

    $('#help').click(this, function(e) {
      const THIS = e.data;
      THIS.s = 0;
      THIS.pushState();
    });

    this.viewer.addHandler('animation', function(e) {
      const THIS = e.userData;
      const scale = THIS.viewer.viewport.getZoom();
      const pan = THIS.viewer.viewport.getCenter();
      THIS.v = [
        round4(scale),
        round4(pan.x),
        round4(pan.y)
      ];
      THIS.newView(false); 
    }, this);

    this.viewer.addHandler('animation-finish', function(e) {
      const THIS = e.userData;
      const scale = THIS.viewer.viewport.getZoom();
      const pan = THIS.viewer.viewport.getCenter();
      THIS.v = [
        round4(scale),
        round4(pan.x),
        round4(pan.y)
      ];
      THIS.pushState();
    }, this);
  },

  /*
   * URL History
   */

  get hash() {
    const hash = location.hash.slice(1);
    const entries = hash.split('#');
    return deserialize(entries);
  },

  get url() {
    const root = location.pathname;
    const search = location.search;
    const hash = location.hash;
    return root + search + hash;
  },

  get hashKeys() {
    const hash = this.hash;
    for (const k in this.hashable) {
      const keys = this.hashable[k];
      if (this.matchQuery(hash, keys)) {
        return keys;
      }
    }
    return [];
  },

  get isHash() {
    return !!this.hashKeys.length;
  },

  /*
   * Hash Keys
   */

  get v() {
    return this.state.v;
  },
  set v(_v) {
    const viewer = this.viewer;
    this.state.v = _v.map(parseFloat);
  },

  get g() {
    const g = this.state.g;
    const count = this.cgs.length;
    return g < count ? g : 0;
  },
  set g(_g) {
    const g = parseInt(_g, 10);
    const count = this.cgs.length;
    this.state.g = modulo(g, count);
  },

  /*
   * Exhibit Hash Keys
   */

  get w() {
    const w = this.state.w[this.s] || 0;
    const count = this.waypoints.length;
    return w < count ? w : 0;
  },

  set w(_w) {
    const w = parseInt(_w, 10);
    const count = this.waypoints.length;
    this.state.w[this.s] = modulo(w, count);

    // Set group, viewport from waypoint
    const waypoint = this.waypoint;

    this.g = gFromWaypoint(waypoint, this.cgs);
    this.v = vFromWaypoint(waypoint);
    this.o = oFromWaypoint(waypoint);
  },

  get s() {
    const s = this.state.s;
    const count = this.stories.length;
    return s < count ? s : 0;
  },
  set s(_s) {
    const s = parseInt(_s, 10);
    const count = this.stories.length;
    this.state.s = modulo(s, count);

    // Only needed to prevent JQuery error
    var sid_index = $('#-s-' + this.s);
    $(sid_index).addClass('active');

    // Update waypoint
    this.w = this.w;
    if (this.s != s) {
      const waypoint = this.waypoint;
      this.d = dFromWaypoint(waypoint);
      this.n = nFromWaypoint(waypoint);
    }
  },

  /*
   * Tag Hash Keys
   */

  get o() {
    return this.state.o;
  },
  set o(_o) {
    this.state.o = _o.map(parseFloat);
  },

  get d() {
    return this.state.description;
  },
  set d(_d) {
    this.state.description = '' + _d;
  },

  get n() {
    return this.state.name;
  },
  set n(_n) {
    this.state.name = '' + _n;
  },

  /*
   * Configuration State
   */
  get changed() {
    return this.state.changed;
  },
  set changed(_c) {
    this.state.changed = !!_c;
  },

  get design() {
    return deepCopy(this.state.design);
  },
  set design(design) {

    const stories = design.stories;

    // Store waypoint indices for each story
    if (this.stories.length != stories.length) {
      this.state.w = stories.map(function(story, s) {
        return this.state.w[s] || 0;
      }, this);
    }

    // Update the design
    this.state.design = deepCopy(design);
  },

  get cgs() {
    return this.design.cgs || [];
  },
  set cgs(_cgs) {
    var design = this.design;
    design.cgs = _cgs;
    this.design = design;
    this.changed = true;
  },

  get chans() {
    return this.design.chans || [];
  },
  set chans(_chans) {
    var design = this.design;
    design.chans = _chans;
    this.design = design;
    this.changed = true;
  },

  get stories() {
    return this.design.stories || [];
  },
  set stories(_stories) {
    var design = this.design;
    design.stories = _stories;
    this.design = design;
    this.changed = true;
  },

  get layout() {
    return this.design.layout || {
      Grid: []
    };
  },
  set layout(_layout) {
    var design = this.design;
    design.layout = _layout;
    this.design = design;
    this.changed = true;
  },

  get images() {
    return this.design.images || [];
  },
  set images(_images) {
    var design = this.design;
    design.images = _images;
    this.design = design;
    this.changed = true;
  },

  get grid() {
    return unpackGrid(this.layout, this.images, 'Grid');
  },

  get target() {
    return unpackGrid(this.layout, this.images, 'Target');
  },

  /*
   * Derived State
   */

  get story() {
    return this.stories[this.s];
  },
  set story(story) {
    const stories = this.stories;
    stories[this.s] = story;
    this.stories = stories;
  },

  get group() {
    return this.cgs[this.g];
  },

  get colors() {
    return this.group.Colors;
  },

  get channels() {
    return this.group.Channels;
  },

  get waypoints() {
    return this.story.Waypoints;
  },
  set waypoints(waypoints) {
    const story = this.story;
    story.Waypoints = waypoints;
    this.story = story;
  },

  get waypoint() {
    return this.waypoints[this.w];
  },
  set waypoint(waypoint) {
    const waypoints = this.waypoints;
    waypoints[this.w] = waypoint;
    this.waypoints = waypoints;
  },

  get viewport() {
    const v = this.v;
    return {
      scale: v[0],
      pan: new OpenSeadragon.Point(v[1], v[2])
    };
  },

  get overlay() {
    const o = this.o;
    return {
      x: o[0],
      y: o[1],
      width: o[2],
      height: o[3]
    };
  },

  /*
   * State manaagement
   */

  matchQuery(hash, hashKeys) {
    const keys = Object.keys(hash);
    if (keys.length != hashKeys.length) {
      return false;
    }
    return hashKeys.reduce(function(accept, key) {
      return accept && hash[key] !== undefined;
    }, true);
  },

  newExhibit() {
    const exhibit = this.exhibit;
    const cgs = deepCopy(exhibit.Groups);
    const stories = deepCopy(exhibit.Stories);
    this.design = {
      chans: deepCopy(exhibit.Channels || []),
      layout: deepCopy(exhibit.Layout || {}),
      images: deepCopy(exhibit.Images || []),
      stories: stories,
      cgs: cgs
    };
  },
  newTag() {
    const exhibit = this.exhibit;
    const stories = deepCopy(exhibit.Stories);
    const group = this.group;
    const o = this.o;
    const v = this.v;
    const d = this.d;
    this.stories = [{
      Description: '',
      Name: 'Tag',
      Waypoints: [{
        Zoom: v[0],
        Pan: v.slice(1),
        Group: group.Name,
        Description: decode(d),
        Name: 'Tag',
        Overlay: {
          x: o[0],
          y: o[1],
          width: o[2],
          height: o[3],
        },
      }]
    }].concat(stories);
  },
  pushState() {
    const hashKeys = this.hashable.exhibit;
    const url = this.makeUrl(hashKeys);
    const title = document.title;
    const design = this.design;

    if (this.url == url && !this.changed) {
      return;
    }

    if (this.hashKeys === hashKeys) {
      history.pushState(design, title, url);
    }
    else {
      // Replace any invalid state
      history.replaceState(design, title, url);
    }
    window.onpopstate();
    this.changed = false;
  },
  popState(e) {
    if (e && e.state) {
      this.changed = false;
      this.design = e.state;
    }
    const hash = this.hash;
    const hashable = this.hashable;
    const hashKeys = this.hashKeys;

    // Accept valid hash
    hashKeys.forEach(function(key) {
      this[key] = hash[key];
    }, this);

    // Setup if invalid hash
    if (!this.isHash) {
      this.newExhibit();
      this.s = 0;
      this.g = 0;
      this.pushState();
    }

    // Do not persist tag in URL
    if (hashKeys === hashable.tag) {
      this.newTag();
      this.s = 0;
      this.g = 0;
      this.pushState();
      $('.modal').modal('hide');
    }

    // Always update
    this.newView(true);
  },
  newView(redraw) {

    this.addOverlay(this.overlay);
    this.fillStoryView();

    // Redraw design
    if(redraw) {
      // Update OpenSeadragon
      const viewport = this.viewer.viewport;
      viewport.panTo(this.viewport.pan);
      viewport.zoomTo(this.viewport.scale);
      newMarkers(this.tileSources, this.group);
    }
  },

  makeUrl(hashKeys) {
    const root = location.pathname;
    const search = location.search;
    const hash = this.makeHash(hashKeys);
    return  root + search + hash;
  },

  makeHash(hashKeys, state) {
    if (state  == undefined) {
      state = this;
    }
    if (hashKeys == undefined) {
      hashKeys = this.hashKeys;
    }
    const hash = serialize(hashKeys, state, '#');
    return hash? '#' + hash : '';
  },

  get currentOverlay() {
    return 'current-overlay-' + 0;
  },

  /*
   * Display manaagement
   */

  addOverlay(overlay) {

    const el = this.currentOverlay;
    const current = this.viewer.getOverlayById(el);
    const xy = new OpenSeadragon.Point(overlay.x, overlay.y);
    if (current) {
      current.update({
        location: xy,
        width: overlay.width,
        height: overlay.height,
      });
    }
    else {
      this.viewer.addOverlay({
        x: overlay.x,
        y: overlay.y,
        width: overlay.width,
        height: overlay.height,
        element: el
      });
    }
  },

  channelOrders(channels) {
    return channels.reduce(function(map, c, i){
      map[c] = i;
      return map;
    }, {});
  },

  indexColor(i, empty) {
    const colors = this.colors;
    if (i === undefined) {
      return empty;
    }
    return '#' + colors[i % colors.length];
  },

  fillStoryView() {
    const md = this.story.Description;
    $('.story-content').html(this.showdown.makeHtml(md));

    // Color code elements
    const channelOrders = this.channelOrders(this.channels);
    const story_code = $('.story-content').find('code');
    for (var i = 0; i < story_code.length; i ++) {
      var code = story_code[i];
      var index = channelOrders[code.innerText];
      var color = this.indexColor(index);
      var border = color? 'solid ' + color: 'dashed #AAA';
      $(code).css('border-bottom', '1px ' + border);
    }
  }
};


const getAjaxHeaders = function(state, image){
  return Promise.resolve({});
};


const getGetTileUrl = function(image, group) {

  return function(level, x, y) {
    return image.Path + '/' + group.Path + '/' + (image.MaxLevel - level) + '_' + x + '_' + y + '.jpg';
  };
};

const arrange_images = function(viewer, tileSources, state, init) {

  const cg = state.g;
  const cgs = state.cgs;
  const grid = state.grid;

  const numRows = grid.length;
  const numColumns = grid[0].length;

  const nTotal = numRows * numColumns * cgs.length;
  var nLoaded = 0;

  const spacingFraction = 0.05;
  const maxImageWidth = flatten(grid).reduce(function(max, img) {
    return Math.max(max, img.Width);
  }, 0);
  const maxImageHeight = flatten(grid).reduce(function(max, img) {
    return Math.max(max, img.Height);
  }, 0);

  const cellHeight = (1 + spacingFraction) / numRows - spacingFraction;
  const cellWidth = cellHeight * maxImageWidth / maxImageHeight;

  for (var yi = 0; yi < numRows; yi++) {
    const y = yi * (cellHeight + spacingFraction);

    for (var xi = 0; xi < numColumns; xi++) {
      const image = grid[yi][xi];
      const displayHeight = (1 - (numRows-1) * spacingFraction) / numRows * image.Height / maxImageHeight;
      const displayWidth = displayHeight * image.Width / image.Height;
      const x = xi * (cellWidth + spacingFraction) + (cellWidth - displayWidth) / 2;

      for (var j=0; j < cgs.length; j++) {
        const group = cgs[j];
        getAjaxHeaders(state, image).then(function(ajaxHeaders){
          const useAjax = false;
          viewer.addTiledImage({
            loadTilesWithAjax: useAjax,
            crossOriginPolicy: useAjax? 'Anonymous': undefined,
            ajaxHeaders: ajaxHeaders,
            tileSource: {
              height: image.Height,
              width:  image.Width,
              maxLevel: image.MaxLevel,
              tileWidth: image.TileSize.slice(0,1).pop(),
              tileHeight: image.TileSize.slice(0,2).pop(),
              getTileUrl: getGetTileUrl(image, group)
            },
            x: x,
            y: y,
            width: displayWidth,
            opacity: group === cgs[cg] ? 1 : 0,
            //preload: true,
            success(data) {
              const item = data.item;
              if (!tileSources.hasOwnProperty(group.Path)) {
                tileSources[group.Path] = [];
              }
              tileSources[group.Path].push(item);

              // Initialize hash state
              nLoaded += 1;
              if (nLoaded == nTotal) {
                init();
              }
            }
          });
        });
      }
      const titleElt = $('<p>');
      const title = image.Description;
      titleElt.addClass('overlay-title').text(title);
      viewer.addOverlay({
        element: titleElt[0],
        x: x + displayWidth / 2,
        y: y,
        placement: 'BOTTOM',
        checkResize: false
      });
      viewer.addOverlay({
        x: x,
        y: y,
        width: displayWidth,
        height: image.Height / image.Width * displayWidth,
        className: 'slide-border'
      });
    }
  }
};

const build_page = function(exhibit) {

  // Initialize openseadragon
  const viewer = OpenSeadragon({
    id: 'openseadragon1',
    prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/2.3.1/images/',
    navigatorPosition: 'BOTTOM_RIGHT',
    zoomOutButton: 'zoom-out',
    zoomInButton: 'zoom-in',
    homeButton: 'zoom-home',
  });
  const tileSources = {};
  const state = new HashState(viewer, tileSources, exhibit);
  const init = state.init.bind(state);
  arrange_images(viewer, tileSources, state, init);
};
const index_name = function(list, name) {
  if (!Array.isArray(list)) {
    return -1;
  }
  const item = list.filter(function(i) {
    return (i.Name == name);
  })[0];
  return list.indexOf(item);
};

const load_yaml = function(url) {
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      try {
        config = jsyaml.safeLoad(this.responseText);
      } catch (e) {
        console.error(e);
      }
      if (config) {
        // Handle Yaml Configuration file
        build_page(config.Exhibit);
      }
    }
  };
  xhttp.open('GET', url, true);
  xhttp.send();
};

load_yaml(minerva_yaml_path);
