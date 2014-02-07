/*
 * OpenSeadragon - Viewport
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
 * @class Viewport
 * @classdesc Handles coordinate-related functionality (zoom, pan, rotation, etc.) for an {@link OpenSeadragon.Viewer}.
 * A new instance is created for each TileSource opened (see {@link OpenSeadragon.Viewer#viewport}).
 *
 * @memberof OpenSeadragon
 */
$.Viewport = function( options ) {

    $.extend( true, this, {

        //required settings
        containerSize:      null,
        contentSize:        null,

        //internal state properties
        zoomPoint:          null,
        viewer:           null,

        //configurable options
        springStiffness:    $.DEFAULT_SETTINGS.springStiffness,
        animationTime:      $.DEFAULT_SETTINGS.animationTime,
        minZoomImageRatio:  $.DEFAULT_SETTINGS.minZoomImageRatio,
        maxZoomPixelRatio:  $.DEFAULT_SETTINGS.maxZoomPixelRatio,
        visibilityRatio:    $.DEFAULT_SETTINGS.visibilityRatio,
        wrapHorizontal:     $.DEFAULT_SETTINGS.wrapHorizontal,
        wrapVertical:       $.DEFAULT_SETTINGS.wrapVertical,
        defaultZoomLevel:   $.DEFAULT_SETTINGS.defaultZoomLevel,
        minZoomLevel:       $.DEFAULT_SETTINGS.minZoomLevel,
        maxZoomLevel:       $.DEFAULT_SETTINGS.maxZoomLevel,
        degrees:            $.DEFAULT_SETTINGS.degrees

    }, options );

    this.centerSpringX = new $.Spring({
        initial: 0,
        springStiffness: this.springStiffness,
        animationTime:   this.animationTime
    });
    this.centerSpringY = new $.Spring({
        initial: 0,
        springStiffness: this.springStiffness,
        animationTime:   this.animationTime
    });
    this.zoomSpring    = new $.Spring({
        initial: 1,
        springStiffness: this.springStiffness,
        animationTime:   this.animationTime
    });

    this.resetContentSize( this.contentSize );
    this.goHome( true );
    this.update();
};

$.Viewport.prototype = /** @lends OpenSeadragon.Viewport.prototype */{

    /**
     * @function
     * @return {OpenSeadragon.Viewport} Chainable.
     * @fires OpenSeadragon.Viewer.event:reset-size
     */
    resetContentSize: function( contentSize ){

        $.console.log('Reset Content Size %s', contentSize.toString());
        this.contentSize    = contentSize;
        this.contentAspectX = this.contentSize.x / this.contentSize.y;
        this.contentAspectY = this.contentSize.y / this.contentSize.x;
        this.fitWidthBounds = new $.Rect( 0, 0, 1, this.contentAspectY );
        this.fitHeightBounds = new $.Rect( 0, 0, this.contentAspectY, this.contentAspectY);

        $.console.log('Fit Width Bounds %s',this.fitWidthBounds.toString());
        $.console.log('Fit Height Bounds %s',this.fitHeightBounds.toString());
        // Home Bounds is the same as fit width
        this.homeBounds = new $.Rect( 0, 0, 1, this.contentAspectY );
        this.updateHomeZoom();

        if( this.viewer ){
            this.viewer.raiseEvent( 'reset-size', {
                contentSize: contentSize
            });
        }

        return this;
    },

    /**
     * @function
     */
    updateHomeZoom: function() {
        // Calculate the ratio of the content aspect ratio to the container aspect ratio
        var aspectFactor = this.contentAspectX / this.getAspectRatio();

        var hz = 1.0;
        $.console.log('Get Home Zoom. Default %s. Aspect Factor %s',this.defaultZoomLevel,aspectFactor);
        if( this.defaultZoomLevel ){
            hz = this.defaultZoomLevel;
        } else {
            hz = ( aspectFactor >= 1 ) ? 1 : aspectFactor;
        }
        this.homeZoom = hz;
        return hz;
    },

    /**
     * @function
     */
    getHomeBounds: function() {
        var center = this.homeBounds.getCenter( ),
            width  = 1.0 / this.homeZoom,
            height = width / this.getAspectRatio();

        $.console.log('Get Home Bounds %s. Center %s. Size %s,%s',this.homeBounds.toStringRounded(),center.toString(),width,height);
        var hb = new $.Rect(
            center.x - ( width / 2.0 ),
            center.y - ( height / 2.0 ),
            width,
            height
        );

        $.console.log('Calc HB %s', hb.toStringRounded());
        return hb;
    },

    /**
     * Fit bounds
     * @function
     * @param {Boolean} immediately
     * @fires OpenSeadragon.Viewer.event:home
     */
    goHome: function( immediately ) {
        $.console.log('-- GO HOME--');
        if( this.viewer ){
            this.viewer.raiseEvent( 'home', {
                immediately: immediately
            });
        }
        $.console.log('Go Home %s', this.getHomeBounds().toStringRounded());
        var res = this.fitBounds( this.getHomeBounds(), immediately );
        $.console.log('-- END GO HOME--');
        return res;
    },

    /**
     * @function
     */
    getMinZoom: function() {
        var zoom = this.minZoomLevel ?
            this.minZoomLevel :
                this.minZoomImageRatio * this.homeZoom;

        return Math.min( zoom, this.homeZoom );
    },

    /**
     * @function
     */
    getMaxZoom: function() {
        var zoom = this.maxZoomLevel ?
            this.maxZoomLevel :
                ( this.contentSize.x * this.maxZoomPixelRatio / this.containerSize.x );

        return Math.max( zoom, this.homeZoom );
    },

    /**
     * @function
     */
    getAspectRatio: function() {
        //return this.containerAspectRatio;
        return this.containerSize.x / this.containerSize.y;
    },

    /**
     * The size * in pixels * of the html element / canvas used to display the content
     *
     * @function
     */
    getContainerSize: function() {
        return new $.Point(
            this.containerSize.x,
            this.containerSize.y
        );
    },

    /**
     * Get the position and size of the viewport in image space.
     *
     * @function
     * @param {Boolean} current - Pass true for the current location; defaults to false (target location).
     */
    getBounds: function( current ) {
        var center = this.getCenter( current ),
            width  = 1.0 / this.getZoom( current ),
            height = width / this.getAspectRatio();

        return new $.Rect(
            center.x - ( width * 0.5 ),
            center.y - ( height * 0.5 ),
            width,
            height
        );
    },

    /**
     * The 'center' is the location of the viewport center in * Image Space *
     *
     * Think of it as 'which part of the image am I looking at'
     *
     * For example :
     * Its 0,0 when the top left of the content is in the middle of the view
     * The Y axis goes from top to bottom, i.e. as the content moves up the screen the center Y increases
     * But the X axis goes from right to left, so as the content moves left, center X increases.
     * Like this :
     *    +
     *    +
     *    +
     * ++++----
     *    -
     *    -
     *    -
     *
     * Because viewport measurements are based on the image width, to put the viewport center in the image center
     * the X value will always be 0.5, but the Y value is also measured in terms of the image width. So for a square
     * image the viewport center -> image center would be 0.5.
     * For images with aspect ratio > 1 (i.e. wider than they are high) the center will be < 1
     * similarly if aspect ratio < 1 (taller than they are high) the center will be > 1
     *
     * @function
     * @param {Boolean} current - Pass true for the current location; defaults to false (target location).
     */
    getCenter: function( current ) {
        var centerCurrent = new $.Point(
                this.centerSpringX.current.value,
                this.centerSpringY.current.value
            ),
            centerTarget = new $.Point(
                this.centerSpringX.target.value,
                this.centerSpringY.target.value
            ),
            oldZoomPixel,
            zoom,
            width,
            height,
            bounds,
            newZoomPixel,
            deltaZoomPixels,
            deltaZoomPoints;

        if ( current ) {
            return centerCurrent;
        } else if ( !this.zoomPoint ) {
            return centerTarget;
        }

        oldZoomPixel = this.pixelFromPoint(this.zoomPoint, true);

        zoom    = this.getZoom();
        width   = 1.0 / zoom;
        height  = width / this.getAspectRatio();
        bounds  = new $.Rect(
            centerCurrent.x - width / 2.0,
            centerCurrent.y - height / 2.0,
            width,
            height
        );

        newZoomPixel    = this.zoomPoint.minus(
            bounds.getTopLeft()
        ).times(
            this.containerSize.x / bounds.width
        );
        deltaZoomPixels = newZoomPixel.minus( oldZoomPixel );
        deltaZoomPoints = deltaZoomPixels.divide( this.containerSize.x * zoom );

        return centerTarget.plus( deltaZoomPoints );
    },

    /**
     * @function
     * @param {Boolean} current - Pass true for the current location; defaults to false (target location).
     */
    getZoom: function( current ) {
        if ( current ) {
            return this.zoomSpring.current.value;
        } else {
            return this.zoomSpring.target.value;
        }
    },

    /**
     * @function
     * @return {OpenSeadragon.Viewport} Chainable.
     * @fires OpenSeadragon.Viewer.event:constrain
     */
    applyConstraints: function( immediately ) {

        //$.console.log('Apply Constraints');

        var actualZoom = this.getZoom(),
            constrainedZoom = Math.max(
                Math.min( actualZoom, this.getMaxZoom() ),
                this.getMinZoom()
            ),
            bounds,
            horizontalThreshold,
            verticalThreshold,
            left,
            right,
            top,
            bottom,
            dx = 0,
            dy = 0;

        if ( actualZoom != constrainedZoom ) {
            this.zoomTo( constrainedZoom, this.zoomPoint, immediately );
        }

        bounds = this.getBounds();

        horizontalThreshold = this.visibilityRatio * bounds.width;
        verticalThreshold   = this.visibilityRatio * bounds.height;

        left   = bounds.x + bounds.width;
        right  = 1 - bounds.x;
        top    = bounds.y + bounds.height;
        bottom = this.contentAspectY - bounds.y;

        if ( this.wrapHorizontal ) {
            //do nothing
        } else {
            if ( left < horizontalThreshold ) {
                dx = horizontalThreshold - left;
            }
            if ( right < horizontalThreshold ) {
                dx = dx ?
                    ( dx + right - horizontalThreshold ) / 2 :
                    ( right - horizontalThreshold );
            }
        }

        if ( this.wrapVertical ) {
            //do nothing
        } else {
            if ( top < verticalThreshold ) {
                dy = ( verticalThreshold - top );
            }
            if ( bottom < verticalThreshold ) {
                dy =  dy ?
                    ( dy + bottom - verticalThreshold ) / 2 :
                    ( bottom - verticalThreshold );
            }
        }

        if ( dx || dy || immediately ) {
            $.console.log('Constrain. dx,dy : %s,%s, Bounds %s',dx,dy,bounds.toStringRounded());
            bounds.x += dx;
            bounds.y += dy;
            if( bounds.width > 1  ){
                bounds.x = 0.5 - bounds.width/2;
            }
            if( bounds.height > this.contentAspectY ){
                bounds.y = this.contentAspectY/2 - bounds.height/2;
            }
            this.fitBounds( bounds, immediately );
        }

        if( this.viewer ){
            this.viewer.raiseEvent( 'constrain', {
                immediately: immediately
            });
        }

        return this;
    },

    /**
     * @function
     * @param {Boolean} immediately
     */
    ensureVisible: function( immediately ) {
        return this.applyConstraints( immediately );
    },

    /**
     * @function
     * @param {OpenSeadragon.Rect} bounds
     * @param {Boolean} immediately
     * @return {OpenSeadragon.Viewport} Chainable.
     */
    fitBounds: function( bounds, immediately ) {
        var aspect = this.getAspectRatio(),
            center = bounds.getCenter(),
            newBounds = new $.Rect(
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height
            ),
            oldBounds,
            oldZoom,
            newZoom,
            referencePoint;

        $.console.log('Fit Bounds %s',newBounds.toStringRounded());

        if ( newBounds.getAspectRatio() >= aspect ) {
            newBounds.height = bounds.width / aspect;
            newBounds.y      = center.y - newBounds.height / 2;
        } else {
            newBounds.width = bounds.height * aspect;
            newBounds.x     = center.x - newBounds.width / 2;
        }

        this.panTo( this.getCenter( true ), true );
        this.zoomTo( this.getZoom( true ), null, true );

        oldBounds = this.getBounds();
        oldZoom   = this.getZoom();
        newZoom   = 1.0 / newBounds.width;
        if ( newZoom == oldZoom || newBounds.width == oldBounds.width ) {
            $.console.log('Zoom Matches, pan immediately to %s',center.toString());
            return this.panTo( center, immediately );
        }

        referencePoint = oldBounds.getTopLeft().times(
            this.containerSize.x / oldBounds.width
        ).minus(
            newBounds.getTopLeft().times(
                this.containerSize.x / newBounds.width
            )
        ).divide(
            this.containerSize.x / oldBounds.width -
            this.containerSize.x / newBounds.width
        );

        $.console.log('Fit Bounds ref point %s',referencePoint.toString());
        return this.zoomTo( newZoom, referencePoint, immediately );
    },


    /**
     * @function
     * @param {Boolean} immediately
     * @return {OpenSeadragon.Viewport} Chainable.
     */
    fitVertically: function( immediately ) {
        var center = this.getCenter();

        if ( this.wrapHorizontal ) {
            center.x = ( 1 + ( center.x % 1 ) ) % 1;
            this.centerSpringX.resetTo( center.x );
            this.centerSpringX.update();
        }

        if ( this.wrapVertical ) {
            center.y = (
                this.contentAspectY + ( center.y % this.contentAspectY )
            ) % this.contentAspectY;
            this.centerSpringY.resetTo( center.y );
            this.centerSpringY.update();
        }

        return this.fitBounds( this.fitHeightBounds, immediately );
    },

    /**
     * @function
     * @param {Boolean} immediately
     * @return {OpenSeadragon.Viewport} Chainable.
     */
    fitHorizontally: function( immediately ) {
        var center = this.getCenter();

        if ( this.wrapHorizontal ) {
            center.x = (
                this.contentAspectX + ( center.x % this.contentAspectX )
            ) % this.contentAspectX;
            this.centerSpringX.resetTo( center.x );
            this.centerSpringX.update();
        }

        if ( this.wrapVertical ) {
            center.y = ( 1 + ( center.y % 1 ) ) % 1;
            this.centerSpringY.resetTo( center.y );
            this.centerSpringY.update();
        }

        return this.fitBounds( this.fitWidthBounds, immediately );
    },


    /**
     * @function
     * @param {OpenSeadragon.Point} delta
     * @param {Boolean} immediately
     * @return {OpenSeadragon.Viewport} Chainable.
     * @fires OpenSeadragon.Viewer.event:pan
     */
    panBy: function( delta, immediately ) {
        var center = new $.Point(
            this.centerSpringX.target.value,
            this.centerSpringY.target.value
        );
        if(this.degrees != 0) {
            delta = delta.rotate( -this.degrees, new $.Point( 0, 0 ) );
        }
        return this.panTo( center.plus( delta ), immediately );
    },

    /**
     * @function
     * @param {OpenSeadragon.Point} center
     * @param {Boolean} immediately
     * @return {OpenSeadragon.Viewport} Chainable.
     * @fires OpenSeadragon.Viewer.event:pan
     */
    panTo: function( center, immediately ) {

        if ( immediately ) {
            $.console.log('Pan To %s %s',center.toString(),immediately ? 'now' : '');
            this.centerSpringX.resetTo( center.x );
            this.centerSpringY.resetTo( center.y );
        } else {
            this.centerSpringX.springTo( center.x );
            this.centerSpringY.springTo( center.y );
        }

        if( this.viewer ){
            this.viewer.raiseEvent( 'pan', {
                center: center,
                immediately: immediately
            });
        }

        return this;
    },

    /**
     * @function
     * @return {OpenSeadragon.Viewport} Chainable.
     * @fires OpenSeadragon.Viewer.event:zoom
     */
    zoomBy: function( factor, refPoint, immediately ) {
        $.console.log('Zoom By %s %O %s',factor, refPoint,immediately ? 'now' : '');
        if( refPoint instanceof $.Point && !isNaN( refPoint.x ) && !isNaN( refPoint.y ) ) {
            if(this.degrees !== 0) {
                refPoint = refPoint.rotate(-this.degrees, new $.Point( this.centerSpringX.target.value, this.centerSpringY.target.value ));
            }
        } else {
            if(this.lastRefPoint == null) {
                this.lastRefPoint = this.homeBounds.getBottomRight().times(0.5);
            }
            refPoint = this.lastRefPoint;
        }
        return this.zoomTo( this.zoomSpring.target.value * factor, refPoint, immediately );
    },

    /**
     * @function
     * @return {OpenSeadragon.Viewport} Chainable.
     * @fires OpenSeadragon.Viewer.event:zoom
     */
    zoomTo: function( zoom, refPoint, immediately ) {

        $.console.log('Zoom To. Zoom : %s. Ref Point : %O',zoom, refPoint);
        this.zoomPoint = refPoint instanceof $.Point &&
            !isNaN(refPoint.x) &&
            !isNaN(refPoint.y) ?
            refPoint :
            null;

        if(refPoint != null) {
            this.lastRefPoint = refPoint;
            $.console.log('Stored Ref Point %s',this.lastRefPoint.toString());
        }

        if ( immediately ) {
            this.zoomSpring.resetTo( zoom );
        } else {
            this.zoomSpring.springTo( zoom );
        }

        if( this.viewer ){
            this.viewer.raiseEvent( 'zoom', {
                zoom: zoom,
                refPoint: refPoint,
                immediately: immediately
            });
        }

        return this;
    },

    /**
     * Currently only 90 degree rotation is supported and it only works
     * with the canvas. Additionally, the navigator does not rotate yet,
     * debug mode doesn't rotate yet, and overlay rotation is only
     * partially supported.
     * @function
     * @return {OpenSeadragon.Viewport} Chainable.
     */
    setRotation: function( degrees ) {
        if( !( this.viewer && this.viewer.canRotate() ) ) {
            return this;
        }

        degrees = ( degrees + 360 ) % 360;
        if( degrees % 90 !== 0 ) {
            throw new Error('Currently only 0, 90, 180, and 270 degrees are supported.');
        }
        this.degrees = degrees;
        this.viewer.update();
        
        return this;
    },

    /**
     * Gets the current rotation in degrees.
     * @function
     * @return {Number} The current rotation in degrees.
     */
    getRotation: function() {
        return this.degrees;
    },

    /**
     * @function
     * @return {OpenSeadragon.Viewport} Chainable.
     * @fires OpenSeadragon.Viewer.event:resize
     */
    resize: function( newContainerSize, maintain ) {
        var oldBounds = this.getBounds(),
            newBounds = oldBounds,
            widthDeltaFactor;

        this.updateContainerSize(newContainerSize);

        if ( maintain ) {
            widthDeltaFactor = newContainerSize.x / this.containerSize.x;
            newBounds.width  = oldBounds.width * widthDeltaFactor;
            newBounds.height = newBounds.width / this.getAspectRatio();
        }

        if( this.viewer ){
            this.viewer.raiseEvent( 'resize', {
                newContainerSize: newContainerSize,
                maintain: maintain
            });
        }

        return this.fitBounds( newBounds, true );
    },
  /**
   * When the vieport is resized the original code first called resize which calls fitBounds
   * then it calculated some new bounds and called fitBounds again.
   * This just updates container size, sends the event and fits the bounds
   * @function
   * @return {OpenSeadragon.Viewport} Chainable.
   * @fires OpenSeadragon.Viewer.event:resize
   */
  resizeToFit: function( newContainerSize, maintain, newBounds ) {

    this.updateContainerSize(newContainerSize);

    if( this.viewer ){
      this.viewer.raiseEvent( 'resize', {
        newContainerSize: newContainerSize,
        maintain: maintain
      });
    }

    return this.fitBounds( newBounds, true );
  },
    updateContainerSize:function( newContainerSize ) {
        this.containerSize = new $.Point(
            newContainerSize.x,
            newContainerSize.y
        );

        this.containerAspectRatio = newContainerSize.x / newContainerSize.y;
        this.updateHomeZoom();
    },
    /**
     * @function
     */
    update: function() {
        var oldCenterX = this.centerSpringX.current.value,
            oldCenterY = this.centerSpringY.current.value,
            oldZoom    = this.zoomSpring.current.value,
            oldZoomPixel,
            newZoomPixel,
            deltaZoomPixels,
            deltaZoomPoints;

        if (this.zoomPoint) {
            oldZoomPixel = this.pixelFromPoint( this.zoomPoint, true );
        }

        this.zoomSpring.update();

        if (this.zoomPoint && this.zoomSpring.current.value != oldZoom) {
            newZoomPixel    = this.pixelFromPoint( this.zoomPoint, true );
            deltaZoomPixels = newZoomPixel.minus( oldZoomPixel );
            deltaZoomPoints = this.deltaPointsFromPixels( deltaZoomPixels, true );

            this.centerSpringX.shiftBy( deltaZoomPoints.x );
            this.centerSpringY.shiftBy( deltaZoomPoints.y );
        } else {
            this.zoomPoint = null;
        }

        this.centerSpringX.update();
        this.centerSpringY.update();

        return this.centerSpringX.current.value != oldCenterX ||
            this.centerSpringY.current.value != oldCenterY ||
            this.zoomSpring.current.value != oldZoom;
    },


    /**
     * Convert a delta (translation vector) from pixels coordinates to viewport coordinates
     * @function
     * @param {Boolean} current - Pass true for the current location; defaults to false (target location).
     */
    deltaPixelsFromPoints: function( deltaPoints, current ) {
        return deltaPoints.times(
            this.containerSize.x * this.getZoom( current )
        );
    },

    /**
     * Convert a delta (translation vector) from viewport coordinates to pixels coordinates.
     * @function
     * @param {Boolean} current - Pass true for the current location; defaults to false (target location).
     */
    deltaPointsFromPixels: function( deltaPixels, current ) {
        return deltaPixels.divide(
            this.containerSize.x * this.getZoom( current )
        );
    },

    /**
     * Convert image pixel coordinates to viewport coordinates.
     * @function
     * @param {Boolean} current - Pass true for the current location; defaults to false (target location).
     */
    pixelFromPoint: function( point, current ) {
        var bounds = this.getBounds( current );
        //$.console.log('Pixel from Point %O. Bounds %O ',point, bounds);
        return point.minus(
            bounds.getTopLeft()
        ).times(
            this.containerSize.x / bounds.width
        );
    },

    /**
     * Convert viewport coordinates to image pixel coordinates.
     * @function
     * @param {Boolean} current - Pass true for the current location; defaults to false (target location).
     */
    pointFromPixel: function( pixel, current ) {
        var bounds = this.getBounds( current );
        return pixel.divide(
            this.containerSize.x / bounds.width
        ).plus(
            bounds.getTopLeft()
        );
    },

    /**
     * Translates from OpenSeadragon viewer coordinate system to image coordinate system.
     * This method can be called either by passing X,Y coordinates or an
     * OpenSeadragon.Point
     * @function
     * @param {OpenSeadragon.Point} viewerX the point in viewport coordinate system.
     * @param {Number} viewerX X coordinate in viewport coordinate system.
     * @param {Number} viewerY Y coordinate in viewport coordinate system.
     * @return {OpenSeadragon.Point} a point representing the coordinates in the image.
     */
    viewportToImageCoordinates: function( viewerX, viewerY ) {
        if ( arguments.length == 1 ) {
            //they passed a point instead of individual components
            var point = viewerX;
            return new $.Point( point.x * this.contentSize.x, point.y * this.contentSize.y * this.contentAspectX );
        }
        return new $.Point( viewerX * this.contentSize.x, viewerY * this.contentSize.y * this.contentAspectX );
    },

    /**
     * Translates from image coordinate system to OpenSeadragon viewer coordinate system
     * This method can be called either by passing X,Y coordinates or an
     * OpenSeadragon.Point
     * @function
     * @param {OpenSeadragon.Point} imageX the point in image coordinate system.
     * @param {Number} imageX X coordinate in image coordinate system.
     * @param {Number} imageY Y coordinate in image coordinate system.
     * @return {OpenSeadragon.Point} a point representing the coordinates in the viewport.
     */
    imageToViewportCoordinates: function( imageX, imageY ) {
        if ( arguments.length == 1 ) {
            //they passed a point instead of individual components
            var point = imageX;
            // TODO : Add brackets to the y calculation to make it explicit because (A / B) / C != A / (B / C)
            return new $.Point( point.x / this.contentSize.x, point.y / this.contentSize.y / this.contentAspectX );
        }
        return new $.Point( imageX / this.contentSize.x, imageY / this.contentSize.y / this.contentAspectX );
    },

    /**
     * Translates from a rectangle which describes a portion of the image in
     * pixel coordinates to OpenSeadragon viewport rectangle coordinates.
     * This method can be called either by passing X,Y,width,height or an
     * OpenSeadragon.Rect
     * @function
     * @param {OpenSeadragon.Rect} imageX the rectangle in image coordinate system.
     * @param {Number} imageX the X coordinate of the top left corner of the rectangle
     * in image coordinate system.
     * @param {Number} imageY the Y coordinate of the top left corner of the rectangle
     * in image coordinate system.
     * @param {Number} pixelWidth the width in pixel of the rectangle.
     * @param {Number} pixelHeight the height in pixel of the rectangle.
     */
    imageToViewportRectangle: function( imageX, imageY, pixelWidth, pixelHeight ) {
        var coordA,
            coordB,
            rect;
        if( arguments.length == 1 ) {
            //they passed a rectangle instead of individual components
            rect = imageX;
            return this.imageToViewportRectangle(
                rect.x, rect.y, rect.width, rect.height
            );
        }
        coordA = this.imageToViewportCoordinates(
            imageX, imageY
        );
        coordB = this.imageToViewportCoordinates(
            pixelWidth, pixelHeight
        );
        return new $.Rect(
            coordA.x,
            coordA.y,
            coordB.x,
            coordB.y
        );
    },

    /**
     * Translates from a rectangle which describes a portion of
     * the viewport in point coordinates to image rectangle coordinates.
     * This method can be called either by passing X,Y,width,height or an
     * OpenSeadragon.Rect
     * @function
     * @param {OpenSeadragon.Rect} viewerX the rectangle in viewport coordinate system.
     * @param {Number} viewerX the X coordinate of the top left corner of the rectangle
     * in viewport coordinate system.
     * @param {Number} imageY the Y coordinate of the top left corner of the rectangle
     * in viewport coordinate system.
     * @param {Number} pointWidth the width of the rectangle in viewport coordinate system.
     * @param {Number} pointHeight the height of the rectangle in viewport coordinate system.
     */
    viewportToImageRectangle: function( viewerX, viewerY, pointWidth, pointHeight ) {
        var coordA,
            coordB,
            rect;
        if ( arguments.length == 1 ) {
            //they passed a rectangle instead of individual components
            rect = viewerX;
            return this.viewportToImageRectangle(
                rect.x, rect.y, rect.width, rect.height
            );
        }
        coordA = this.viewportToImageCoordinates( viewerX, viewerY );
        coordB = this.viewportToImageCoordinates( pointWidth, pointHeight );
        return new $.Rect(
            coordA.x,
            coordA.y,
            coordB.x,
            coordB.y
        );
    },

    /**
     * Convert pixel coordinates relative to the viewer element to image
     * coordinates.
     * @param {OpenSeadragon.Point} pixel
     * @returns {OpenSeadragon.Point}
     */
    viewerElementToImageCoordinates: function( pixel ) {
        var point = this.pointFromPixel( pixel, true );
        return this.viewportToImageCoordinates( point );
    },

    /**
     * Convert pixel coordinates relative to the image to
     * viewer element coordinates.
     * @param {OpenSeadragon.Point} point
     * @returns {OpenSeadragon.Point}
     */
    imageToViewerElementCoordinates: function( point ) {
        var pixel = this.pixelFromPoint( point, true );
        return this.imageToViewportCoordinates( pixel );
    },

    /**
     * Convert pixel coordinates relative to the window to image coordinates.
     * @param {OpenSeadragon.Point} pixel
     * @returns {OpenSeadragon.Point}
     */
    windowToImageCoordinates: function( pixel ) {
        var viewerCoordinates = pixel.minus(
                OpenSeadragon.getElementPosition( this.viewer.element ));
        return this.viewerElementToImageCoordinates( viewerCoordinates );
    },

    /**
     * Convert image coordinates to pixel coordinates relative to the window.
     * @param {OpenSeadragon.Point} pixel
     * @returns {OpenSeadragon.Point}
     */
    imageToWindowCoordinates: function( pixel ) {
        var viewerCoordinates = this.imageToViewerElementCoordinates( pixel );
        return viewerCoordinates.plus(
                OpenSeadragon.getElementPosition( this.viewer.element ));
    },

    /**
     * Convert pixel coordinates relative to the viewer element to viewport
     * coordinates.
     * @param {OpenSeadragon.Point} pixel
     * @returns {OpenSeadragon.Point}
     */
    viewerElementToViewportCoordinates: function( pixel ) {
        return this.pointFromPixel( pixel, true );
    },

    /**
     * Convert viewport coordinates to pixel coordinates relative to the
     * viewer element.
     * @param {OpenSeadragon.Point} point
     * @returns {OpenSeadragon.Point}
     */
    viewportToViewerElementCoordinates: function( point ) {
        return this.pixelFromPoint( point, true );
    },

    /**
     * Convert pixel coordinates relative to the window to viewport coordinates.
     * @param {OpenSeadragon.Point} pixel
     * @returns {OpenSeadragon.Point}
     */
    windowToViewportCoordinates: function( pixel ) {
        var viewerCoordinates = pixel.minus(
                OpenSeadragon.getElementPosition( this.viewer.element ));
        return this.viewerElementToViewportCoordinates( viewerCoordinates );
    },

    /**
     * Convert viewport coordinates to pixel coordinates relative to the window.
     * @param {OpenSeadragon.Point} point
     * @returns {OpenSeadragon.Point}
     */
    viewportToWindowCoordinates: function( point ) {
        var viewerCoordinates = this.viewportToViewerElementCoordinates( point );
        return viewerCoordinates.plus(
                OpenSeadragon.getElementPosition( this.viewer.element ));
    },
    
    /**
     * Convert a viewport zoom to an image zoom.
     * Image zoom: ratio of the original image size to displayed image size.
     * 1 means original image size, 0.5 half size...
     * Viewport zoom: ratio of the displayed image's width to viewport's width.
     * 1 means identical width, 2 means image's width is twice the viewport's width...
     * @function
     * @param {Number} viewportZoom The viewport zoom
     * target zoom.
     * @returns {Number} imageZoom The image zoom
     */
    viewportToImageZoom: function( viewportZoom ) {
        var imageWidth = this.viewer.source.dimensions.x;
        var containerWidth = this.getContainerSize().x;
        var viewportToImageZoomRatio = containerWidth / imageWidth;
        return viewportZoom * viewportToImageZoomRatio;
    },
    
    /**
     * Convert an image zoom to a viewport zoom.
     * Image zoom: ratio of the original image size to displayed image size.
     * 1 means original image size, 0.5 half size...
     * Viewport zoom: ratio of the displayed image's width to viewport's width.
     * 1 means identical width, 2 means image's width is twice the viewport's width...
     * @function
     * @param {Number} imageZoom The image zoom
     * target zoom.
     * @returns {Number} viewportZoom The viewport zoom
     */
    imageToViewportZoom: function( imageZoom ) {
        var imageWidth = this.viewer.source.dimensions.x;
        var containerWidth = this.getContainerSize().x;
        var viewportToImageZoomRatio = imageWidth / containerWidth;
        return imageZoom * viewportToImageZoomRatio;
    }
};

}( OpenSeadragon ));
