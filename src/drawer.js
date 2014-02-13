/*
 * OpenSeadragon - Drawer
 *
 * Copyright (C) 2009 CodePlex Foundation
 * Copyright (C) 2010-2013 OpenSeadragon contributors
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * - Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 *
 * - Redistributions in binary form must reproduce the above copyright
 *   notice, this list of conditions and the following disclaimer in the
 *   documentation and/or other materials provided with the distribution.
 *
 * - Neither the name of CodePlex Foundation nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

(function( $ ){

var DEVICE_SCREEN       = $.getWindowSize(),
    BROWSER             = $.Browser.vendor,
    BROWSER_VERSION     = $.Browser.version,

    SUBPIXEL_RENDERING = (
        ( BROWSER == $.BROWSERS.FIREFOX ) ||
        ( BROWSER == $.BROWSERS.OPERA )   ||
        ( BROWSER == $.BROWSERS.SAFARI && BROWSER_VERSION >= 4 ) ||
        ( BROWSER == $.BROWSERS.CHROME && BROWSER_VERSION >= 2 ) ||
        ( BROWSER == $.BROWSERS.IE     && BROWSER_VERSION >= 9 )
    );


/**
 * @class Drawer
 * @classdesc Handles rendering of tiles for an {@link OpenSeadragon.Viewer}. 
 * A new instance is created for each TileSource opened (see {@link OpenSeadragon.Viewer#drawer}).
 *
 * @memberof OpenSeadragon
 * @param {OpenSeadragon.TileSource} source - Reference to Viewer tile source.
 * @param {OpenSeadragon.Viewport} viewport - Reference to Viewer viewport.
 * @param {Element} element - Parent element.
 */
$.Drawer = function( options ) {

    //backward compatibility for positional args while prefering more
    //idiomatic javascript options object as the only argument
    var args  = arguments,
        i;

    if( !$.isPlainObject( options ) ){
        options = {
            source:     args[ 0 ], // Reference to Viewer tile source.
            viewport:   args[ 1 ], // Reference to Viewer viewport.
            element:    args[ 2 ]  // Parent element.
        };
    }

    $.console.log('Drawer Options %O',options);

    $.extend( true, this, {

        //internal state properties
        viewer:         null,
        downloading:    0,     // How many images are currently being loaded in parallel.
        tilesMatrix:    {},    // A '3d' dictionary [level][x][y] --> Tile.
        tilesLoaded:    [],    // An unordered list of Tiles with loaded images.
        coverage:       {},    // A '3d' dictionary [level][x][y] --> Boolean.
        lastDrawn:      [],    // An unordered list of Tiles drawn last frame.
        lastResetTime:  0,     // Last time for which the drawer was reset.
        midUpdate:      false, // Is the drawer currently updating the viewport?
        updateAgain:    true,  // Does the drawer need to update the viewport again?


        //internal state / configurable settings
        overlays:           [], // An unordered list of Overlays added.
        collectionOverlays: {},

        //configurable settings
        maxImageCacheCount: $.DEFAULT_SETTINGS.maxImageCacheCount,
        imageLoaderLimit:   $.DEFAULT_SETTINGS.imageLoaderLimit,
        minZoomImageRatio:  $.DEFAULT_SETTINGS.minZoomImageRatio,
        wrapHorizontal:     $.DEFAULT_SETTINGS.wrapHorizontal,
        wrapVertical:       $.DEFAULT_SETTINGS.wrapVertical,
        immediateRender:    $.DEFAULT_SETTINGS.immediateRender,
        blendTime:          $.DEFAULT_SETTINGS.blendTime,
        alwaysBlend:        $.DEFAULT_SETTINGS.alwaysBlend,
        minPixelRatio:      $.DEFAULT_SETTINGS.minPixelRatio,
        debugMode:          $.DEFAULT_SETTINGS.debugMode,
        timeout:            $.DEFAULT_SETTINGS.timeout

    }, options );

    $.console.log('Drawer %O',this);

    this.useCanvas  = $.supportsCanvas && ( this.viewer ? this.viewer.useCanvas : true );
    if(this.useCanvas) {
        this.renderer = new $.TileCanvasRenderer();
    } else {
        this.renderer = new $.TileHtmlRenderer();
    }
    /**
     * The parent element of this Drawer instance, passed in when the Drawer was created.
     * The parent of {@link OpenSeadragon.Drawer#canvas}.
     * @member {Element} container
     * @memberof OpenSeadragon.Drawer#
     */
    this.container  = $.getElement( this.element );
    /**
     * A &lt;canvas&gt; element if the browser supports them, otherwise a &lt;div&gt; element.
     * Child element of {@link OpenSeadragon.Drawer#container}.
     * @member {Element} canvas
     * @memberof OpenSeadragon.Drawer#
     */
    this.canvas     = $.makeNeutralElement( this.useCanvas ? "canvas" : "div" );
    /**
     * 2d drawing context for {@link OpenSeadragon.Drawer#canvas} if it's a &lt;canvas&gt; element, otherwise null.
     * @member {Object} context
     * @memberof OpenSeadragon.Drawer#
     */
    this.context    = this.useCanvas ? this.canvas.getContext( "2d" ) : null;
    // Ratio of zoomable image height to width.
    this.normHeight = this.source.dimensions.y / this.source.dimensions.x;
    /**
     * @member {Element} element
     * @memberof OpenSeadragon.Drawer#
     * @deprecated Alias for {@link OpenSeadragon.Drawer#container}.
     */
    this.element    = this.container;

    // We force our container to ltr because our drawing math doesn't work in rtl.
    // This issue only affects our canvas renderer, but we do it always for consistency.
    // Note that this means overlays you want to be rtl need to be explicitly set to rtl.
    this.container.dir = 'ltr';

    this.canvas.style.width     = "100%";
    this.canvas.style.height    = "100%";
    this.canvas.style.position  = "absolute";

    // explicit left-align
    this.container.style.textAlign = "left";
    this.container.appendChild( this.canvas );

    //create the correct type of overlay by convention if the overlays
    //are not already OpenSeadragon.Overlays
    for( i = 0; i < this.overlays.length; i++ ){
        if( $.isPlainObject( this.overlays[ i ] ) ){

            this.overlays[ i ] = addOverlayFromConfiguration( this, this.overlays[ i ]);

        } else if ( $.isFunction( this.overlays[ i ] ) ){
            //TODO
        }
    }

    //this.profiler    = new $.Profiler();
};

$.Drawer.prototype = /** @lends OpenSeadragon.Drawer.prototype */{

    /**
     * Adds an html element as an overlay to the current viewport.  Useful for
     * highlighting words or areas of interest on an image or other zoomable
     * interface.
     * @method
     * @param {Element|String|Object} element - A reference to an element or an id for
     *      the element which will overlayed. Or an Object specifying the configuration for the overlay
     * @param {OpenSeadragon.Point|OpenSeadragon.Rect} location - The point or
     *      rectangle which will be overlayed.
     * @param {OpenSeadragon.OverlayPlacement} placement - The position of the
     *      viewport which the location coordinates will be treated as relative
     *      to.
     * @param {function} onDraw - If supplied the callback is called when the overlay 
     *      needs to be drawn. It it the responsibility of the callback to do any drawing/positioning.
     *      It is passed position, size and element.
     * @fires OpenSeadragon.Viewer.event:add-overlay
     */
    addOverlay: function( element, location, placement, onDraw ) {

        var options;
        if( $.isPlainObject( element ) ){
            options = element;
        } else {
            options = {
                element: element,
                location: location,
                placement: placement,
                onDraw: onDraw
            };
        }

        element = $.getElement(options.element);

        $.console.log('Drawer::addOverlay. Options : %O.', options);

        if ( getOverlayIndex( this.overlays, element ) >= 0 ) {
            // they're trying to add a duplicate overlay
            return;
        }

        this.overlays.push( new $.Overlay({
            element: element,
            location: options.location,
            placement: options.placement,
            onDraw: options.onDraw
        }) );
        this.updateAgain = true;
        if( this.viewer ){
            /**
             * Raised when an overlay is added to the viewer (see {@link OpenSeadragon.Drawer#addOverlay}).
             *
             * @event add-overlay
             * @memberof OpenSeadragon.Viewer
             * @type {object}
             * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
             * @property {Element} element - The overlay element.
             * @property {OpenSeadragon.Point|OpenSeadragon.Rect} location
             * @property {OpenSeadragon.OverlayPlacement} placement
             * @property {?Object} userData - Arbitrary subscriber-defined object.
             */
            this.viewer.raiseEvent( 'add-overlay', {
                element: element,
                location: options.location,
                placement: options.placement
            });
        }
        return this;
    },

    /**
     * Updates the overlay represented by the reference to the element or
     * element id moving it to the new location, relative to the new placement.
     * @method
     * @param {OpenSeadragon.Point|OpenSeadragon.Rect} location - The point or
     *      rectangle which will be overlayed.
     * @param {OpenSeadragon.OverlayPlacement} placement - The position of the
     *      viewport which the location coordinates will be treated as relative
     *      to.
     * @return {OpenSeadragon.Drawer} Chainable.
     * @fires OpenSeadragon.Viewer.event:update-overlay
     */
    updateOverlay: function( element, location, placement ) {
        var i;

        element = $.getElement( element );
        i = getOverlayIndex( this.overlays, element );

        if ( i >= 0 ) {
            this.overlays[ i ].update( location, placement );
            this.updateAgain = true;
        }
        if( this.viewer ){
            /**
             * Raised when an overlay's location or placement changes (see {@link OpenSeadragon.Drawer#updateOverlay}).
             *
             * @event update-overlay
             * @memberof OpenSeadragon.Viewer
             * @type {object}
             * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
             * @property {Element} element
             * @property {OpenSeadragon.Point|OpenSeadragon.Rect} location
             * @property {OpenSeadragon.OverlayPlacement} placement
             * @property {?Object} userData - Arbitrary subscriber-defined object.
             */
            this.viewer.raiseEvent( 'update-overlay', {
                element: element,
                location: location,
                placement: placement
            });
        }
        return this;
    },

    /**
     * Removes and overlay identified by the reference element or element id
     *      and schedules and update.
     * @method
     * @param {Element|String} element - A reference to the element or an
     *      element id which represent the ovelay content to be removed.
     * @return {OpenSeadragon.Drawer} Chainable.
     * @fires OpenSeadragon.Viewer.event:remove-overlay
     */
    removeOverlay: function( element ) {
        var i;

        element = $.getElement( element );
        i = getOverlayIndex( this.overlays, element );

        if ( i >= 0 ) {
            this.overlays[ i ].destroy();
            this.overlays.splice( i, 1 );
            this.updateAgain = true;
        }
        if( this.viewer ){
            /**
             * Raised when an overlay is removed from the viewer (see {@link OpenSeadragon.Drawer#removeOverlay}).
             *
             * @event remove-overlay
             * @memberof OpenSeadragon.Viewer
             * @type {object}
             * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
             * @property {Element} element - The overlay element.
             * @property {?Object} userData - Arbitrary subscriber-defined object.
             */
            this.viewer.raiseEvent( 'remove-overlay', {
                element: element
            });
        }
        return this;
    },

    /**
     * Removes all currently configured Overlays from this Drawer and schedules
     *      and update.
     * @method
     * @return {OpenSeadragon.Drawer} Chainable.
     * @fires OpenSeadragon.Viewer.event:clear-overlay
     */
    clearOverlays: function() {
        while ( this.overlays.length > 0 ) {
            this.overlays.pop().destroy();
            this.updateAgain = true;
        }
        if( this.viewer ){
            /**
             * Raised when all overlays are removed from the viewer (see {@link OpenSeadragon.Drawer#clearOverlays}).
             *
             * @event clear-overlay
             * @memberof OpenSeadragon.Viewer
             * @type {object}
             * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
             * @property {?Object} userData - Arbitrary subscriber-defined object.
             */
            this.viewer.raiseEvent( 'clear-overlay', {} );
        }
        return this;
    },


    /**
     * Returns whether the Drawer is scheduled for an update at the
     *      soonest possible opportunity.
     * @method
     * @returns {Boolean} - Whether the Drawer is scheduled for an update at the
     *      soonest possible opportunity.
     */
    needsUpdate: function() {
        return this.updateAgain;
    },

    /**
     * Returns the total number of tiles that have been loaded by this Drawer.
     * @method
     * @returns {Number} - The total number of tiles that have been loaded by
     *      this Drawer.
     */
    numTilesLoaded: function() {
        return this.tilesLoaded.length;
    },

    /**
     * Clears all tiles and triggers an update on the next call to
     * Drawer.prototype.update().
     * @method
     * @return {OpenSeadragon.Drawer} Chainable.
     */
    reset: function() {
        clearTiles( this );
        this.lastResetTime = $.now();
        this.updateAgain = true;
        return this;
    },

    /**
     * Forces the Drawer to update.
     * @method
     * @return {OpenSeadragon.Drawer} Chainable.
     */
    update: function() {
        this.midUpdate = true;
        updateViewport( this );
        this.midUpdate = false;
        return this;
    },

    /**
     * Used internally to load images when required.  May also be used to
     * preload a set of images so the browser will have them available in
     * the local cache to optimize user experience in certain cases. Because
     * the number of parallel image loads is configurable, if too many images
     * are currently being loaded, the request will be ignored.  Since by
     * default drawer.imageLoaderLimit is 0, the native browser parallel
     * image loading policy will be used.
     * @method
     * @param {String} src - The url of the image to load.
     * @param {Function} callback - The function that will be called with the
     *      Image object as the only parameter if it was loaded successfully.
     *      If an error occured, or the request timed out or was aborted,
     *      the parameter is null instead.
     * @return {Boolean} loading - Whether the request was submitted or ignored
     *      based on OpenSeadragon.DEFAULT_SETTINGS.imageLoaderLimit.
     */
    loadImage: function( src, callback ) {
        var _this = this,
            loading = false,
            image,
            jobid,
            complete;

        if ( !this.imageLoaderLimit ||
              this.downloading < this.imageLoaderLimit ) {

            this.downloading++;

            image = new Image();
            image.crossOrigin = 'Anonymous';

            complete = function( imagesrc, resultingImage ){
                _this.downloading--;
                if (typeof ( callback ) == "function") {
                    try {
                        callback( resultingImage );
                    } catch ( e ) {
                        $.console.error(
                            "%s while executing %s callback: %s",
                            e.name,
                            src,
                            e.message,
                            e
                        );
                    }
                }
            };

            image.onload = function(){
                finishLoadingImage( image, complete, true, jobid );
            };

            image.onabort = image.onerror = function(){
                finishLoadingImage( image, complete, false, jobid );
            };

            jobid = window.setTimeout( function(){
                finishLoadingImage( image, complete, false, jobid );
            }, this.timeout );

            loading   = true;
            $.console.log('Loading image %s',src);
            image.src = src;
        }

        return loading;
    },

    /**
     * Returns whether rotation is supported or not.
     * @method
     * @return {Boolean} True if rotation is supported.
     */
    canRotate: function() {
        return this.useCanvas;
    }
};

/**
 * @private
 * @inner
 */
 function addOverlayFromConfiguration( drawer, overlay ){

    var element  = null,
        rect = ( overlay.height && overlay.width ) ? new $.Rect(
            overlay.x || overlay.px,
            overlay.y || overlay.py,
            overlay.width,
            overlay.height
        ) : new $.Point(
            overlay.x || overlay.px,
            overlay.y || overlay.py
        ),
        id = overlay.id ?
            overlay.id :
            "openseadragon-overlay-"+Math.floor(Math.random()*10000000);

    element = $.getElement(overlay.id);
    if( !element ){
        element         = document.createElement("a");
        element.href    = "#/overlay/"+id;
    }
    element.id        = id;
    $.addClass( element, overlay.className ?
        overlay.className :
        "openseadragon-overlay"
    );


    if(overlay.px !== undefined){
        //if they specified 'px' so it's in pixel coordinates so
        //we need to translate to viewport coordinates
        rect = drawer.viewport.imageToViewportRectangle( rect );
    }
    
    if( overlay.placement ){
        return new $.Overlay({
            element: element,
            location: drawer.viewport.pointFromPixel(rect),
            placement: $.OverlayPlacement[overlay.placement.toUpperCase()],
            onDraw: overlay.onDraw
        });
    }else{
        return new $.Overlay({
            element: element,
            location: rect,
            onDraw: overlay.onDraw
        });
    }

}

/**
 * @private
 * @inner
 * Pretty much every other line in this needs to be documented so it's clear
 * how each piece of this routine contributes to the drawing process.  That's
 * why there are so many TODO's inside this function.
 */
function updateViewport( drawer ) {

    drawer.updateAgain = false;

    if( drawer.viewer ){
        /**
         * <em>- Needs documentation -</em>
         *
         * @event update-viewport
         * @memberof OpenSeadragon.Viewer
         * @type {object}
         * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
         * @property {?Object} userData - Arbitrary subscriber-defined object.
         */
        drawer.viewer.raiseEvent( 'update-viewport', {} );
    }

    var tile,
        level,
        best            = null,
        haveDrawn       = false,
        currentTime     = $.now(),
        viewportSize    = drawer.viewport.getContainerSize(),
        viewportBounds  = drawer.viewport.getBounds( true ),
        viewportTL      = viewportBounds.getTopLeft(),
        viewportBR      = viewportBounds.getBottomRight(),
        zeroRatioC      = drawer.viewport.deltaPixelsFromPoints(
            drawer.source.getPixelRatio( 0 ),
            true
        ).x,
        lowestLevel     = Math.max(
            drawer.source.minLevel,
            Math.floor(
                Math.log( drawer.minZoomImageRatio ) /
                Math.log( 2 )
            )
        ),
        highestLevel    = Math.min(
            Math.abs(drawer.source.maxLevel),
            Math.abs(Math.floor(
                Math.log( zeroRatioC / drawer.minPixelRatio ) /
                Math.log( 2 )
            ))
        ),
        degrees         = drawer.viewport.degrees,
        renderPixelRatioC,
        renderPixelRatioT,
        zeroRatioT,
        optimalRatio,
        levelOpacity,
        levelVisibility;

    //TODO
    while ( drawer.lastDrawn.length > 0 ) {
        tile = drawer.lastDrawn.pop();
        tile.beingDrawn = false;
    }

    //TODO
    drawer.canvas.innerHTML   = "";
    if ( drawer.useCanvas ) {
        if( drawer.canvas.width  != viewportSize.x ||
            drawer.canvas.height != viewportSize.y ){
            drawer.canvas.width  = viewportSize.x;
            drawer.canvas.height = viewportSize.y;
        }
        drawer.context.clearRect( 0, 0, viewportSize.x, viewportSize.y );
    }

    //Change bounds for rotation
    if (degrees === 90 || degrees === 270) {
        var rotatedBounds = viewportBounds.rotate( degrees );
        viewportTL = rotatedBounds.getTopLeft();
        viewportBR = rotatedBounds.getBottomRight();
    }

    //Don't draw if completely outside of the viewport
    if  ( !drawer.wrapHorizontal &&
        ( viewportBR.x < 0 || viewportTL.x > 1 ) ) {
        return;
    } else if
        ( !drawer.wrapVertical &&
        ( viewportBR.y < 0 || viewportTL.y > drawer.normHeight ) ) {
        return;
    }

    // Constrain viewport within bounds
    if ( !drawer.wrapHorizontal ) {
        viewportTL.x = Math.max( viewportTL.x, 0 );
        viewportBR.x = Math.min( viewportBR.x, 1 );
    }
    if ( !drawer.wrapVertical ) {
        viewportTL.y = Math.max( viewportTL.y, 0 );
        viewportBR.y = Math.min( viewportBR.y, drawer.normHeight );
    }

   //$.console.log('Drawing. Lowest %s. Highest %s', lowestLevel, highestLevel);
    //TODO
    lowestLevel = Math.min( lowestLevel, highestLevel );

    //TODO
    var drawLevel; // FIXME: drawLevel should have a more explanatory name
    for ( level = highestLevel; level >= lowestLevel; level-- ) {
        drawLevel = false;

        //Avoid calculations for draw if we have already drawn this
        renderPixelRatioC = drawer.viewport.deltaPixelsFromPoints(
            drawer.source.getPixelRatio( level ),
            true
        ).x;

        if ( ( !haveDrawn && renderPixelRatioC >= drawer.minPixelRatio ) ||
             ( level == lowestLevel ) ) {
            drawLevel = true;
            haveDrawn = true;
        } else if ( !haveDrawn ) {
            continue;
        }

        //Perform calculations for draw if we haven't drawn this
        renderPixelRatioT = drawer.viewport.deltaPixelsFromPoints(
            drawer.source.getPixelRatio( level ),
            false
        ).x;

        zeroRatioT      = drawer.viewport.deltaPixelsFromPoints(
            drawer.source.getPixelRatio(
                Math.max(
                    drawer.source.getClosestLevel( drawer.viewport.containerSize ) - 1,
                    0
                )
            ),
            false
        ).x;

        optimalRatio    = drawer.immediateRender ?
            1 :
            zeroRatioT;

        levelOpacity    = Math.min( 1, ( renderPixelRatioC - 0.5 ) / 0.5 );

        levelVisibility = optimalRatio / Math.abs(
            optimalRatio - renderPixelRatioT
        );

        //TODO
        best = updateLevel(
            drawer,
            haveDrawn,
            drawLevel,
            level,
            levelOpacity,
            levelVisibility,
            viewportTL,
            viewportBR,
            currentTime,
            best
        );

        //TODO
        if (  providesCoverage( drawer.coverage, level ) ) {
            break;
        }
    }

    //TODO
    drawTiles( drawer, drawer.lastDrawn );
    drawOverlays( drawer.viewport, drawer.overlays, drawer.container );

    //TODO
    if ( best ) {
        loadTile( drawer, best, currentTime );
        // because we haven't finished drawing, so
        drawer.updateAgain = true;
    }

}


function updateLevel( drawer, haveDrawn, drawLevel, level, levelOpacity, levelVisibility, viewportTL, viewportBR, currentTime, best ){

    var x, y,
        tileTL,
        tileBR,
        numberOfTiles,
        viewportCenter  = drawer.viewport.pixelFromPoint( drawer.viewport.getCenter() );


    if( drawer.viewer ){
        /**
         * <em>- Needs documentation -</em>
         *
         * @event update-level
         * @memberof OpenSeadragon.Viewer
         * @type {object}
         * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
         * @property {Object} havedrawn
         * @property {Object} level
         * @property {Object} opacity
         * @property {Object} visibility
         * @property {Object} topleft
         * @property {Object} bottomright
         * @property {Object} currenttime
         * @property {Object} best
         * @property {?Object} userData - Arbitrary subscriber-defined object.
         */
        drawer.viewer.raiseEvent( 'update-level', {
            havedrawn: haveDrawn,
            level: level,
            opacity: levelOpacity,
            visibility: levelVisibility,
            topleft: viewportTL,
            bottomright: viewportBR,
            currenttime: currentTime,
            best: best
        });
    }

    //OK, a new drawing so do your calculations
    tileTL    = drawer.source.getTileAtPoint( level, viewportTL );
    tileBR    = drawer.source.getTileAtPoint( level, viewportBR );
    numberOfTiles  = drawer.source.getNumTiles( level );

    resetCoverage( drawer.coverage, level );

    if ( !drawer.wrapHorizontal ) {
        tileBR.x = Math.min( tileBR.x, numberOfTiles.x - 1 );
    }
    if ( !drawer.wrapVertical ) {
        tileBR.y = Math.min( tileBR.y, numberOfTiles.y - 1 );
    }

    for ( x = tileTL.x; x <= tileBR.x; x++ ) {
        for ( y = tileTL.y; y <= tileBR.y; y++ ) {

            best = updateTile(
                drawer,
                drawLevel,
                haveDrawn,
                x, y,
                level,
                levelOpacity,
                levelVisibility,
                viewportCenter,
                numberOfTiles,
                currentTime,
                best
            );

        }
    }

    return best;
}

function updateTile( drawer, drawLevel, haveDrawn, x, y, level, levelOpacity, levelVisibility, viewportCenter, numberOfTiles, currentTime, best){

    var tile = getTile(
            x, y,
            level,
            drawer.source,
            drawer.tilesMatrix,
            currentTime,
            numberOfTiles,
            drawer.normHeight
        ),
        drawTile = drawLevel;

    if( drawer.viewer ){
        /**
         * <em>- Needs documentation -</em>
         *
         * @event update-tile
         * @memberof OpenSeadragon.Viewer
         * @type {object}
         * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
         * @property {OpenSeadragon.Tile} tile
         * @property {?Object} userData - Arbitrary subscriber-defined object.
         */
        drawer.viewer.raiseEvent( 'update-tile', {
            tile: tile
        });
    }

    setCoverage( drawer.coverage, level, x, y, false );

    if ( !tile.exists ) {
        return best;
    }

    if ( haveDrawn && !drawTile ) {
        if ( isCovered( drawer.coverage, level, x, y ) ) {
            setCoverage( drawer.coverage, level, x, y, true );
        } else {
            drawTile = true;
        }
    }

    if ( !drawTile ) {
        return best;
    }

    positionTile(
        tile,
        drawer.source.tileOverlap,
        drawer.viewport,
        viewportCenter,
        levelVisibility
    );

    if ( tile.loaded ) {
        var needsUpdate = blendTile(
            drawer,
            tile,
            x, y,
            level,
            levelOpacity,
            currentTime
        );

        if ( needsUpdate ) {
            drawer.updateAgain = true;
        }
    } else if ( tile.loading ) {
        // the tile is already in the download queue
        // thanks josh1093 for finally translating this typo
    } else {
        best = compareTiles( best, tile );
    }

    return best;
}

function getTile( x, y, level, tileSource, tilesMatrix, time, numTiles, normHeight ) {
    var xMod,
        yMod,
        bounds,
        exists,
        url,
        tile;

    if ( !tilesMatrix[ level ] ) {
        tilesMatrix[ level ] = {};
    }
    if ( !tilesMatrix[ level ][ x ] ) {
        tilesMatrix[ level ][ x ] = {};
    }

    if ( !tilesMatrix[ level ][ x ][ y ] ) {
        xMod    = ( numTiles.x + ( x % numTiles.x ) ) % numTiles.x;
        yMod    = ( numTiles.y + ( y % numTiles.y ) ) % numTiles.y;
        bounds  = tileSource.getTileBounds( level, xMod, yMod );
        exists  = tileSource.tileExists( level, xMod, yMod );
        url     = tileSource.getTileUrl( level, xMod, yMod );

        bounds.x += 1.0 * ( x - xMod ) / numTiles.x;
        bounds.y += normHeight * ( y - yMod ) / numTiles.y;

        tilesMatrix[ level ][ x ][ y ] = new $.Tile(
            level,
            x,
            y,
            bounds,
            exists,
            url
        );
    }

    tile = tilesMatrix[ level ][ x ][ y ];
    tile.lastTouchTime = time;

    return tile;
}


function loadTile( drawer, tile, time ) {
    if( drawer.viewport.collectionMode ){
        drawer.midUpdate = false;
        onTileLoad( drawer, tile, time );
    } else {
        tile.loading = drawer.loadImage(
            tile.url,
            function( image ){
                onTileLoad( drawer, tile, time, image );
            }
        );
    }
}

function onTileLoad( drawer, tile, time, image ) {
    var insertionIndex,
        cutoff,
        worstTile,
        worstTime,
        worstLevel,
        worstTileIndex,
        prevTile,
        prevTime,
        prevLevel,
        i;

    tile.loading = false;

    if ( drawer.midUpdate ) {
        $.console.warn( "Tile load callback in middle of drawing routine." );
        return;
    } else if ( !image  && !drawer.viewport.collectionMode ) {
        $.console.log( "Tile %s failed to load: %s", tile, tile.url );
        if( !drawer.debugMode ){
            tile.exists = false;
            return;
        }
    } else if ( time < drawer.lastResetTime ) {
        $.console.log( "Ignoring tile %s loaded before reset: %s", tile, tile.url );
        return;
    }

    tile.loaded = true;
    tile.image  = image;

    insertionIndex = drawer.tilesLoaded.length;

    if ( drawer.tilesLoaded.length >= drawer.maxImageCacheCount ) {
        cutoff = Math.ceil( Math.log( drawer.source.tileSize ) / Math.log( 2 ) );

        worstTile       = null;
        worstTileIndex  = -1;

        for ( i = drawer.tilesLoaded.length - 1; i >= 0; i-- ) {
            prevTile = drawer.tilesLoaded[ i ];

            if ( prevTile.level <= drawer.cutoff || prevTile.beingDrawn ) {
                continue;
            } else if ( !worstTile ) {
                worstTile       = prevTile;
                worstTileIndex  = i;
                continue;
            }

            prevTime    = prevTile.lastTouchTime;
            worstTime   = worstTile.lastTouchTime;
            prevLevel   = prevTile.level;
            worstLevel  = worstTile.level;

            if ( prevTime < worstTime ||
               ( prevTime == worstTime && prevLevel > worstLevel ) ) {
                worstTile       = prevTile;
                worstTileIndex  = i;
            }
        }

        if ( worstTile && worstTileIndex >= 0 ) {
            worstTile.unload();
            drawer.renderer.unload(worstTile);
            insertionIndex = worstTileIndex;
        }
    }

    drawer.tilesLoaded[ insertionIndex ] = tile;
    drawer.updateAgain = true;
}

/**
 * Called every render update.
 *
 * @param tile
 * @param overlap
 * @param viewport
 * @param viewportCenter
 * @param levelVisibility
 */
function positionTile( tile, overlap, viewport, viewportCenter, levelVisibility ){
    var boundsTL     = tile.bounds.getTopLeft(),
        boundsSize   = tile.bounds.getSize(),
        positionC    = viewport.pixelFromPoint( boundsTL, true ),
        positionT    = viewport.pixelFromPoint( boundsTL, false ),
        sizeC        = viewport.deltaPixelsFromPoints( boundsSize, true ),
        sizeT        = viewport.deltaPixelsFromPoints( boundsSize, false ),
        tileCenter   = positionT.plus( sizeT.divide( 2 ) ),
        tileDistance = viewportCenter.distanceTo( tileCenter );

    if ( !overlap ) {
        sizeC = sizeC.plus( new $.Point( 1, 1 ) );
    }

    //$.console.log('Position Tile. Pos: %O. Size: %O. Distance: %s. Visibility: %s.',positionC, sizeC, tileDistance, levelVisibility);
    tile.position   = positionC;
    tile.size       = sizeC;
    tile.distance   = tileDistance;
    tile.visibility = levelVisibility;
}


function blendTile( drawer, tile, x, y, level, levelOpacity, currentTime ){
    var blendTimeMillis = 1000 * drawer.blendTime,
        deltaTime,
        opacity;

    if ( !tile.blendStart ) {
        tile.blendStart = currentTime;
    }

    deltaTime   = currentTime - tile.blendStart;
    opacity     = blendTimeMillis ? Math.min( 1, deltaTime / ( blendTimeMillis ) ) : 1;

    if ( drawer.alwaysBlend ) {
        opacity *= levelOpacity;
    }

    tile.opacity = opacity;

    drawer.lastDrawn.push( tile );

    if ( opacity == 1 ) {
        setCoverage( drawer.coverage, level, x, y, true );
    } else if ( deltaTime < blendTimeMillis ) {
        return true;
    }

    return false;
}


function clearTiles( drawer ) {
    drawer.tilesMatrix = {};
    drawer.tilesLoaded = [];
}

/**
 * @private
 * @inner
 * Returns true if the given tile provides coverage to lower-level tiles of
 * lower resolution representing the same content. If neither x nor y is
 * given, returns true if the entire visible level provides coverage.
 *
 * Note that out-of-bounds tiles provide coverage in this sense, since
 * there's no content that they would need to cover. Tiles at non-existent
 * levels that are within the image bounds, however, do not.
 */
function providesCoverage( coverage, level, x, y ) {
    var rows,
        cols,
        i, j;

    if ( !coverage[ level ] ) {
        return false;
    }

    if ( x === undefined || y === undefined ) {
        rows = coverage[ level ];
        for ( i in rows ) {
            if ( rows.hasOwnProperty( i ) ) {
                cols = rows[ i ];
                for ( j in cols ) {
                    if ( cols.hasOwnProperty( j ) && !cols[ j ] ) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    return (
        coverage[ level ][ x] === undefined ||
        coverage[ level ][ x ][ y ] === undefined ||
        coverage[ level ][ x ][ y ] === true
    );
}

/**
 * @private
 * @inner
 * Returns true if the given tile is completely covered by higher-level
 * tiles of higher resolution representing the same content. If neither x
 * nor y is given, returns true if the entire visible level is covered.
 */
function isCovered( coverage, level, x, y ) {
    if ( x === undefined || y === undefined ) {
        return providesCoverage( coverage, level + 1 );
    } else {
        return (
             providesCoverage( coverage, level + 1, 2 * x, 2 * y ) &&
             providesCoverage( coverage, level + 1, 2 * x, 2 * y + 1 ) &&
             providesCoverage( coverage, level + 1, 2 * x + 1, 2 * y ) &&
             providesCoverage( coverage, level + 1, 2 * x + 1, 2 * y + 1 )
        );
    }
}

/**
 * @private
 * @inner
 * Sets whether the given tile provides coverage or not.
 */
function setCoverage( coverage, level, x, y, covers ) {
    if ( !coverage[ level ] ) {
        $.console.warn(
            "Setting coverage for a tile before its level's coverage has been reset: %s",
            level
        );
        return;
    }

    if ( !coverage[ level ][ x ] ) {
        coverage[ level ][ x ] = {};
    }

    coverage[ level ][ x ][ y ] = covers;
}

/**
 * @private
 * @inner
 * Resets coverage information for the given level. This should be called
 * after every draw routine. Note that at the beginning of the next draw
 * routine, coverage for every visible tile should be explicitly set.
 */
function resetCoverage( coverage, level ) {
    coverage[ level ] = {};
}

/**
 * @private
 * @inner
 * Determines the 'z-index' of the given overlay.  Overlays are ordered in
 * a z-index based on the order they are added to the Drawer.
 */
function getOverlayIndex( overlays, element ) {
    var i;
    for ( i = overlays.length - 1; i >= 0; i-- ) {
        if ( overlays[ i ].element == element ) {
            return i;
        }
    }

    return -1;
}

/**
 * @private
 * @inner
 * Determines whether the 'last best' tile for the area is better than the
 * tile in question.
 */
function compareTiles( previousBest, tile ) {
    if ( !previousBest ) {
        return tile;
    }

    if ( tile.visibility > previousBest.visibility ) {
        return tile;
    } else if ( tile.visibility == previousBest.visibility ) {
        if ( tile.distance < previousBest.distance ) {
            return tile;
        }
    }

    return previousBest;
}

function finishLoadingImage( image, callback, successful, jobid ){

    $.console.log('Image Loaded %O',image);
    image.onload = null;
    image.onabort = null;
    image.onerror = null;

    if ( jobid ) {
        window.clearTimeout( jobid );
    }
    $.requestAnimationFrame( function() {
        callback( image.src, successful ? image : null);
    });

}


function drawOverlays( viewport, overlays, container ){
    var i,
        length = overlays.length;
    for ( i = 0; i < length; i++ ) {
        drawOverlay( viewport, overlays[ i ], container );
    }
}

function drawOverlay( viewport, overlay, container ){

    overlay.position = viewport.pixelFromPoint(
        overlay.bounds.getTopLeft(),
        true
    );
    overlay.size     = viewport.deltaPixelsFromPoints(
        overlay.bounds.getSize(),
        true
    );
    overlay.drawHTML( container, viewport );
}

function drawTiles( drawer, lastDrawn ){
    var i,
        tile;

    for ( i = lastDrawn.length - 1; i >= 0; i-- ) {
        tile = lastDrawn[ i ];

        if ( drawer.useCanvas ) {

            // TODO do this in a more performant way
            // specifically, don't save,rotate,restore every time we draw a tile
            if( drawer.viewport.degrees !== 0 ) {
                offsetForRotation( tile, drawer.canvas, drawer.context, drawer.viewport.degrees );
                drawer.renderer.render(tile, drawer.context);
                restoreRotationChanges( tile, drawer.canvas, drawer.context );
            } else {
                drawer.renderer.render(tile, drawer.context);
            }
        } else {
            drawer.renderer.render(tile, drawer.canvas);
        }

        tile.beingDrawn = true;

        if( drawer.debugMode ){
            try{
                drawer.renderer.debug( drawer, tile, lastDrawn.length, i );
            }catch(e){
                $.console.error(e);
            }
        }

        if( drawer.viewer ){
            /**
             * <em>- Needs documentation -</em>
             *
             * @event tile-drawn
             * @memberof OpenSeadragon.Viewer
             * @type {object}
             * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
             * @property {OpenSeadragon.Tile} tile
             * @property {?Object} userData - Arbitrary subscriber-defined object.
             */
            drawer.viewer.raiseEvent( 'tile-drawn', {
                tile: tile
            });
        }
    }
}

function offsetForRotation( tile, canvas, context, degrees ){
    var cx = canvas.width >> 1,
        cy = canvas.height >> 1,
        px = tile.position.x - cx,
        py = tile.position.y - cy;

    context.save();

    context.translate(cx, cy);
    context.rotate( Math.PI / 180 * degrees);
    tile.position.x = px;
    tile.position.y = py;
}

function restoreRotationChanges( tile, canvas, context ){
    var cx = canvas.width >> 1,
        cy = canvas.height >> 1,
        px = tile.position.x + cx,
        py = tile.position.y + cy;

    tile.position.x = px;
    tile.position.y = py;

    context.restore();
}

}( OpenSeadragon ));
