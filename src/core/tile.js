/*
 * OpenSeadragon - Tile
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
 * @class Tile
 * @memberof OpenSeadragon
 * @param {Number} level The zoom level this tile belongs to.
 * @param {Number} x The vector component 'x'.
 * @param {Number} y The vector component 'y'.
 * @param {OpenSeadragon.Point} bounds Where this tile fits, in normalized
 *      coordinates.
 * @param {Boolean} exists Is this tile a part of a sparse image? ( Also has
 *      this tile failed to load? )
 * @param {String} url The URL of this tile's image.
 */
$.Tile = function(level, x, y, bounds, exists, url) {
    //$.console.info('New Tile. Level: %s. Pos: %s,%s. Bounds: %O. Exists: %s. URL: %s',level,x, y,bounds,exists,url);
    /**
     * The zoom level this tile belongs to.
     * @member {Number} level
     * @memberof OpenSeadragon.Tile#
     */
    this.level   = level;
    /**
     * The vector component 'x'.
     * @member {Number} x
     * @memberof OpenSeadragon.Tile#
     */
    this.x       = x;
    /**
     * The vector component 'y'.
     * @member {Number} y
     * @memberof OpenSeadragon.Tile#
     */
    this.y       = y;
    /**
     * Where this tile fits, in normalized coordinates
     * @member {OpenSeadragon.Point} bounds
     * @memberof OpenSeadragon.Tile#
     */
    this.bounds  = bounds;
    /**
     * Is this tile a part of a sparse image? Also has this tile failed to load?
     * @member {Boolean} exists
     * @memberof OpenSeadragon.Tile#
     */
    this.exists  = exists;
    /**
     * The URL of this tile's image.
     * @member {String} url
     * @memberof OpenSeadragon.Tile#
     */
    this.url     = url;
    /**
     * Is this tile loaded?
     * @member {Boolean} loaded
     * @memberof OpenSeadragon.Tile#
     */
    this.loaded  = false;
    /**
     * Image loading promise. Use loading.isPending() to see if its still loading
     * @member {Q.Promise} loading
     * @memberof OpenSeadragon.Tile#
     */
    this.loading = null;

    /**
     * The HTML div element for this tile
     * @member {Element} element
     * @memberof OpenSeadragon.Tile#
     */
    this.element    = null;
    /**
     * The HTML img element for this tile.
     * @member {Element} imgElement
     * @memberof OpenSeadragon.Tile#
     */
    this.imgElement = null;
    /**
     * The Image object for this tile.
     * @member {Object} image
     * @memberof OpenSeadragon.Tile#
     */
    this.image      = null;

    /**
     * The alias of this.element.style.
     * @member {String} style
     * @memberof OpenSeadragon.Tile#
     */
    this.style      = null;
    /**
     * This tile's position on screen, in pixels.
     * @member {OpenSeadragon.Point} position
     * @memberof OpenSeadragon.Tile#
     */
    this.position   = null;
    /**
     * This tile's size on screen, in pixels.
     * @member {OpenSeadragon.Point} size
     * @memberof OpenSeadragon.Tile#
     */
    this.size       = null;
    /**
     * The start time of this tile's blending.
     * @member {Number} blendStart
     * @memberof OpenSeadragon.Tile#
     */
    this.blendStart = null;
    /**
     * The current opacity this tile should be.
     * @member {Number} opacity
     * @memberof OpenSeadragon.Tile#
     */
    this.opacity    = 1;
    /**
     * The distance of this tile to the viewport center.
     * @member {Number} distance
     * @memberof OpenSeadragon.Tile#
     */
    this.distance   = null;
    /**
     * The visibility score of this tile.
     * @member {Number} visibility
     * @memberof OpenSeadragon.Tile#
     */
    this.visibility = null;

    /**
     * Whether this tile is currently being drawn.
     * @member {Boolean} beingDrawn
     * @memberof OpenSeadragon.Tile#
     */
    this.beingDrawn     = false;
    /**
     * Timestamp the tile was last touched.
     * @member {Number} lastTouchTime
     * @memberof OpenSeadragon.Tile#
     */
    this.lastTouchTime  = 0;

    /**
     * Is this a png image.
     * Used for alpha testing during rendering
     * @member {Boolean}
     */
    if(this.url) {
        this.isPNG = this.url.match('.png');
    } else {
        this.isPNG = false;
    }
};

$.Tile.prototype = /** @lends OpenSeadragon.Tile.prototype */{

    /**
     * Provides a string representation of this tiles level and (x,y)
     * components.
     * @function
     * @returns {String}
     */
    toString: function() {
        return this.level + "/" + this.x + "_" + this.y;
    },

    /**
     * Removes tile from its container.
     * @function
     */
    unload: function() {

        //$.console.log('Unload Tile. %O',this);

        this.image      = null;
        this.loaded     = false;
        this.loading    = null;
    },
    getBetterTile:function(otherTile) {
        if ( !otherTile ) {
            return this;
        }
        if ( this.visibility > otherTile.visibility ) {
            return this;
        } else if ( this.visibility == otherTile.visibility ) {
//            $.console.info('Check tile distances %s -> %s',this.distance,otherTile.distance);
            if ( this.distance < otherTile.distance ) {
                return this;
            }
        }

        return otherTile;
    }
};

}( OpenSeadragon ));
