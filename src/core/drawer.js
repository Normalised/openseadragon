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
        this.renderer = new $.TileCanvasRenderer({debugGridColor:options.debugGridColor,debugTextColor:options.debugTextColor});
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

    var useOwnCanvas = this.canvas === undefined;
    if(useOwnCanvas) {
        $.console.log('Creating canvas %O', this.canvas);
        this.canvas     = $.makeNeutralElement( this.useCanvas ? "canvas" : "div" );
    } else {
        $.console.log('Using supplied canvas %O', this.canvas);
    }
    /**
     * 2d drawing context for {@link OpenSeadragon.Drawer#canvas} if it's a &lt;canvas&gt; element, otherwise null.
     * @member {Object} context
     * @memberof OpenSeadragon.Drawer#
     */
    this.context    = this.useCanvas ? this.canvas.getContext( "2d" ) : null;
    // Ratio of zoomable image height to width.
    this.normHeight = this.source.dimensions.y / this.source.dimensions.x;

    // We force our container to ltr because our drawing math doesn't work in rtl.
    // This issue only affects our canvas renderer, but we do it always for consistency.
    // Note that this means overlays you want to be rtl need to be explicitly set to rtl.
    this.container.dir = 'ltr';
    // explicit left-align
    this.container.style.textAlign = "left";

    if(useOwnCanvas) {
        this.canvas.style.width     = "100%";
        this.canvas.style.height    = "100%";
        this.canvas.style.position  = "absolute";
        this.container.appendChild( this.canvas );
    }

    //create the correct type of overlay by convention if the overlays
    //are not already OpenSeadragon.Overlays
    for( i = 0; i < this.overlays.length; i++ ){
        if( $.isPlainObject( this.overlays[ i ] ) ){

            this.overlays[ i ] = $.OverlayFactory.create( this.viewport, this.overlays[ i ]);

        } else if ( $.isFunction( this.overlays[ i ] ) ){
            //TODO
        }
    }

    this.lowestLevelK = Math.floor( Math.log( this.minZoomImageRatio ) /  Math.log( 2 ) );
    this.zeroPixelRatio  = this.source.getPixelRatio(0);
    this.lowestLevelK2 = Math.max( this.source.minLevel, this.lowestLevelK);
    this.oneOverMinPixelRatio = 1.0 / this.minPixelRatio;

    // Check contentBounds are configured
    if(this.contentBounds === null) {
        this.contentBounds = new $.Rect(0,0,1,1);
    } else {
        $.console.log('Using Content Bounds %s', this.contentBounds.toString());
    }
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
        this.clearTiles();
        this.lastResetTime = $.now();
        this.updateAgain = true;
        return this;
    },

    /**
     * Forces the Drawer to update.
     * @method
     * @return {OpenSeadragon.Drawer} Chainable.
     */
    update: function(bounds) {
        this.midUpdate = true;
        this.draw( bounds );
        this.midUpdate = false;
        return this;
    },

    /**
     * Returns whether rotation is supported or not.
     * @method
     * @return {Boolean} True if rotation is supported.
     */
    canRotate: function() {
        return this.useCanvas;
    },
    draw:function(bounds) {

        this.updateAgain = false;

        if( this.viewer ){
            this.viewer.raiseEvent( 'update-viewport', {} );
        }

        // TODO : Precalculate
        // All of these are constant values so can be precalculated
        var tileSource  = this.source;
//        var pixelRatio  = tileSource.getPixelRatio(0);
//        var lowestLevel = Math.max( this.source.minLevel, this.lowestLevelK);
        var lowestLevel = this.lowestLevelK2;
        // deltaPixels depends on the current zoom level
        var deltaPixels = this.viewport.deltaPixelsFromPoints( this.zeroPixelRatio, true);
        var zeroRatioC  = deltaPixels.x;

        //$.console.log('PR %O. DP %O. ZRC %s',pixelRatio, deltaPixels, zeroRatioC);
        var tile,
            currentTime     = $.now(),
            viewportTL      = bounds.getTopLeft(),
            viewportBR      = bounds.getBottomRight(),
            highestLevel    = Math.min(
                tileSource.maxLevel,
                Math.abs(Math.floor( Math.log( zeroRatioC * this.oneOverMinPixelRatio ) / Math.log( 2 ) ))
            ),
            degrees         = this.viewport.degrees;

        //TODO
        while ( this.lastDrawn.length > 0 ) {
            tile = this.lastDrawn.pop();
            tile.beingDrawn = false;
        }

        //Change bounds for rotation
        if (degrees === 90 || degrees === 270) {
            var rotatedBounds = bounds.rotate( degrees );
            viewportTL = rotatedBounds.getTopLeft();
            viewportBR = rotatedBounds.getBottomRight();
        }

        //Don't draw if completely outside of the viewport
        if  ( !this.wrapHorizontal &&
            ( viewportBR.x < 0 || viewportTL.x > 1 ) ) {
            return;
        } else if
            ( !this.wrapVertical &&
            ( viewportBR.y < 0 || viewportTL.y > this.normHeight ) ) {
            return;
        }

        // Constrain viewport within bounds
        if ( !this.wrapHorizontal ) {
            viewportTL.x = Math.max( viewportTL.x, 0 );
            viewportBR.x = Math.min( viewportBR.x, 1 );
        }
        if ( !this.wrapVertical ) {
            viewportTL.y = Math.max( viewportTL.y, 0 );
            viewportBR.y = Math.min( viewportBR.y, this.normHeight );
        }

        lowestLevel = Math.min( lowestLevel, highestLevel );

        var best = this.updateVisibilityAndLevels(lowestLevel, highestLevel, viewportTL, viewportBR, currentTime);
        this.drawTiles();
        drawOverlays( this.viewport, this.overlays, this.container );

        //TODO
        if ( best ) {
            this.loadTile( best, currentTime );
            // because we haven't finished drawing, so
            this.updateAgain = true;
        }

    },
    loadTile:function(tile, time) {
        if(tile.loading) {
            return;
        }
        var promise = $.ImageLoader.loadImage(tile.url);
        $.console.log('Load Tile %O : %s',promise,tile.url);
        tile.loading = promise;
        var _this = this;
        promise.then(function(image){
            $.console.log('Tile Loaded %s',tile.url);
            _this.onTileLoad( tile, time, image );
        });
    },
    updateVisibilityAndLevels:function(lowestLevel, highestLevel, viewportTL, viewportBR, currentTime) {
        var level,
            best = null,
            haveDrawn       = false,
            renderPixelRatioC,
            renderPixelRatioT,
            zeroRatioT,
            optimalRatio,
            levelOpacity,
            levelVisibility;

        var drawLevel;
        // Loop from the highest resolution to the lowest resolution level
        for ( level = highestLevel; level >= lowestLevel; level-- ) {
            drawLevel = false;

            //Avoid calculations for draw if we have already drawn this
            renderPixelRatioC = this.viewport.deltaPixelsFromPoints( this.source.getPixelRatio( level ), true ).x;

            if ( ( !haveDrawn && (renderPixelRatioC >= this.minPixelRatio) ) || ( level == lowestLevel ) ) {
                drawLevel = true;
                haveDrawn = true;
            } else if ( !haveDrawn ) {
                continue;
            }

            //Perform calculations for draw if we haven't drawn this
            renderPixelRatioT = this.viewport.deltaPixelsFromPoints( this.source.getPixelRatio( level ), false ).x;
            zeroRatioT      = this.viewport.deltaPixelsFromPoints(
                this.source.getPixelRatio( Math.max( this.source.getClosestLevel( this.viewport.containerSize ) - 1, 0 ) ), false ).x;

            optimalRatio    = this.immediateRender ? 1 : zeroRatioT;

            levelOpacity    = Math.min( 1, ( renderPixelRatioC - 0.5 ) * 2 );

            levelVisibility = optimalRatio / Math.abs( optimalRatio - renderPixelRatioT );

            //TODO
            best = this.updateLevel(haveDrawn, drawLevel, level, levelOpacity, levelVisibility, viewportTL, viewportBR, currentTime, best);

            //TODO
            if ( this.providesCoverage( level ) ) {
                break;
            }
        }
        return best;
    },
    drawTiles:function(){
        var i,
            tile;

        for ( i = this.lastDrawn.length - 1; i >= 0; i-- ) {
            tile = this.lastDrawn[ i ];

            if ( this.useCanvas ) {

                // TODO do this in a more performant way
                // specifically, don't save,rotate,restore every time we draw a tile
                if( this.viewport.degrees !== 0 ) {
                    offsetForRotation( tile, this.canvas, this.context, this.viewport.degrees );
                    this.renderer.render(tile, this.context);
                    restoreRotationChanges( tile, this.canvas, this.context );
                } else {
                    this.renderer.render(tile, this.context);
                }
            } else {
                this.renderer.render(tile, this.canvas);
            }

            tile.beingDrawn = true;

            if( this.debugMode ){
                this.renderer.debug( this, tile, this.lastDrawn.length, i );
            }

            if( this.viewer ){
                this.viewer.raiseEvent( 'tile-drawn', {
                    tile: tile
                });
            }
        }
    },
    onTileLoad:function( tile, time, image ) {

        $.console.log('Drawer On Tile Load %O', tile);
        var insertionIndex;

        tile.loading = null;

        if ( this.midUpdate ) {
            $.console.warn( "Tile load callback in middle of drawing routine." );
            return;
        } else if ( !image ) {
            $.console.log( "Tile %s failed to load: %s", tile, tile.url );
            if( !this.debugMode ){
                tile.exists = false;
                return;
            }
        } else if ( time < this.lastResetTime ) {
            $.console.log( "Ignoring tile %s loaded before reset: %s", tile, tile.url );
            return;
        }

        tile.loaded = true;
        tile.image  = image;

        insertionIndex = this.tilesLoaded.length;

        if ( this.tilesLoaded.length >= this.maxImageCacheCount ) {
            insertionIndex = this.pruneTileCache(insertionIndex);
        }

        this.tilesLoaded[ insertionIndex ] = tile;
        this.updateAgain = true;
    },
    pruneTileCache:function(insertionIndex) {
        var cutoff,
            worstTile,
            worstTime,
            worstLevel,
            worstTileIndex,
            prevTile,
            prevTime,
            prevLevel,
            i;

        cutoff = Math.ceil( Math.log( this.source.tileSize ) / Math.log( 2 ) );

        worstTile       = null;
        worstTileIndex  = -1;

        for ( i = this.tilesLoaded.length - 1; i >= 0; i-- ) {
            prevTile = this.tilesLoaded[ i ];

            if ( prevTile.level <= cutoff || prevTile.beingDrawn ) {
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
            this.renderer.unload(worstTile);
            insertionIndex = worstTileIndex;
        }

        return insertionIndex;
    },
    updateLevel:function( haveDrawn, drawLevel, level, levelOpacity, levelVisibility, viewportTL, viewportBR, currentTime, best ){

        var x, y,
            tileTL,
            tileBR,
            numberOfTiles,
            viewportCenter  = this.viewport.pixelFromPoint( this.viewport.getCenter() );

        if( this.viewer ){
            this.viewer.raiseEvent( 'update-level', {
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
        tileTL    = this.source.getTileAtPoint( level, viewportTL );
        tileBR    = this.source.getTileAtPoint( level, viewportBR );
        numberOfTiles  = this.source.getNumTiles( level );

        this.resetCoverage( level );

        if ( !this.wrapHorizontal ) {
            tileBR.x = Math.min( tileBR.x, numberOfTiles.x - 1 );
        }
        if ( !this.wrapVertical ) {
            tileBR.y = Math.min( tileBR.y, numberOfTiles.y - 1 );
        }

        for ( x = tileTL.x; x <= tileBR.x; x++ ) {
            for ( y = tileTL.y; y <= tileBR.y; y++ ) {
                best = this.updateTile( drawLevel, haveDrawn, x, y, level, levelOpacity, levelVisibility, viewportCenter, numberOfTiles, currentTime, best);
            }
        }

        return best;
    },
    updateTile:function( drawLevel, haveDrawn, x, y, level, levelOpacity, levelVisibility, viewportCenter, numberOfTiles, currentTime, best){

        var tile = this.getTile( x, y, level, this.source, this.tilesMatrix, currentTime, numberOfTiles, this.normHeight ),
            drawTile = drawLevel;

        if( this.viewer ){
            this.viewer.raiseEvent( 'update-tile', {
                tile: tile
            });
        }

        this.setCoverage( level, x, y, false );

        if ( !tile.exists ) {
            $.console.log('Tile Doesnt Exist, Send back best %O',best);
            return best;
        }

        if ( haveDrawn && !drawTile ) {
            if ( this.isCovered( level, x, y ) ) {
                this.setCoverage( level, x, y, true );
            } else {
                drawTile = true;
            }
        }

        if ( !drawTile ) {
            return best;
        }

        tile.visibility = levelVisibility;
        this.positionTile( tile, this.source.tileOverlap, this.viewport, viewportCenter);

        if ( tile.loaded ) {
            if(this.blendTime) {
                if(this.blendTile( tile, x, y, level, levelOpacity, currentTime )) {
                    this.updateAgain = true;
                }
            } else {
                this.showTile(tile, x, y, level);
            }

        } else if ( tile.loading && !tile.loading.isFulfilled() ) {
            $.console.log("Tile is loading %s", tile.url);
        } else {
            best = tile.getBetterTile(best);
        }

        return best;
    },
    getTile:function( x, y, level, tileSource, tilesMatrix, time, numTiles, normHeight ) {
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

            tilesMatrix[ level ][ x ][ y ] = new $.Tile( level, x, y, bounds, exists, url );
        }

        tile = tilesMatrix[ level ][ x ][ y ];
        tile.lastTouchTime = time;

        return tile;
    },
    setCoverage:function( level, x, y, covers ) {
        if ( !this.coverage[ level ] ) {
            $.console.warn(
                "Setting coverage for a tile before its level's coverage has been reset: %s",
                level
            );
            return;
        }

        if ( !this.coverage[ level ][ x ] ) {
            this.coverage[ level ][ x ] = {};
        }

        this.coverage[ level ][ x ][ y ] = covers;
    },
    showTile:function( tile, x, y, level) {
        // Tile opacity is now set to 1 as default rather than null
        this.lastDrawn.push( tile );
        this.setCoverage( level, x, y, true );
    },
    blendTile:function( tile, x, y, level, levelOpacity, currentTime ){
        var blendTimeMillis = 1000 * this.blendTime,
            deltaTime,
            opacity;

        if ( !tile.blendStart ) {
            tile.blendStart = currentTime;
        }

        deltaTime   = currentTime - tile.blendStart;
        opacity     = blendTimeMillis ? Math.min( 1, deltaTime / ( blendTimeMillis ) ) : 1;

        if ( this.alwaysBlend ) {
            opacity *= levelOpacity;
        }

        tile.opacity = opacity;

        this.lastDrawn.push( tile );

        if ( opacity == 1 ) {
            this.setCoverage( this.coverage, level, x, y, true );
        } else if ( deltaTime < blendTimeMillis ) {
            return true;
        }

        return false;
    },
    /**
     *
     * @param tile
     * @param overlap
     * @param viewport
     * @param viewportCenter
     */
    positionTile: function( tile, overlap, viewport, viewportCenter ){
        var boundsTL            = tile.bounds.getTopLeft(),
            boundsSize          = tile.bounds.getSize(),
            currentPosition     = viewport.pixelFromPoint( boundsTL, true ),
            targetPosition      = viewport.pixelFromPoint( boundsTL, false ),
            currentSize         = viewport.deltaPixelsFromPoints( boundsSize, true ),
            targetSize          = viewport.deltaPixelsFromPoints( boundsSize, false ),
            tileCenter          = targetPosition.plus( targetSize.divide( 2 ) ),
            tileDistance        = viewportCenter.distanceTo( tileCenter );

        if ( !overlap ) {
            currentSize = currentSize.plus( new $.Point( 1, 1 ) );
        }

        //$.console.log('Position Tile. Pos: %O. Size: %O. Distance: %s. Visibility: %s.',positionC, sizeC, tileDistance, levelVisibility);
        tile.position   = currentPosition;
        tile.size       = currentSize;
        tile.distance   = tileDistance;
    },
    clearTiles:function() {
        this.tilesMatrix = {};
        this.tilesLoaded = [];
    },
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
    providesCoverage:function( level, x, y ) {
        var rows,
            cols,
            i, j;

        if ( !this.coverage[ level ] ) {
            return false;
        }

        if ( x === undefined || y === undefined ) {
            rows = this.coverage[ level ];
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
            this.coverage[ level ][ x ]      === undefined ||
            this.coverage[ level ][ x ][ y ] === undefined ||
            this.coverage[ level ][ x ][ y ] === true
        );
    },

    /**
     * @private
     * @inner
     * Returns true if the given tile is completely covered by higher-level
     * tiles of higher resolution representing the same content. If neither x
     * nor y is given, returns true if the entire visible level is covered.
     */
    isCovered:function( level, x, y ) {
        if ( x === undefined || y === undefined ) {
            return this.providesCoverage( level + 1 );
        } else {
            return (
                this.providesCoverage( this.coverage, level + 1, 2 * x, 2 * y ) &&
                    this.providesCoverage( this.coverage, level + 1, 2 * x, 2 * y + 1 ) &&
                    this.providesCoverage( this.coverage, level + 1, 2 * x + 1, 2 * y ) &&
                    this.providesCoverage( this.coverage, level + 1, 2 * x + 1, 2 * y + 1 )
                );
        }
    },

    /**
     * @private
     * @inner
     * Resets coverage information for the given level. This should be called
     * after every draw routine. Note that at the beginning of the next draw
     * routine, coverage for every visible tile should be explicitly set.
     */
    resetCoverage:function( level ) {
        this.coverage[ level ] = {};
    }



};


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
