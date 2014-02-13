/*
 * OpenSeadragon - Overlay
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
     * @class Renderable
     * @classdesc Provides a way to render graphic layers on top of a specific tile source.
     * The location must be specified in co-ordinates normalised to the tile source between 0 and 1.
     * The onDraw callback will be called with pixel co-ordinates
     *
     * @memberof OpenSeadragon
     * @param {Object} options
     * @param {OpenSeadragon.Rect} options.location The position of the layer in normalised co-ordinates (0 -> 1)
     * @param {OpenSeadragon.Renderable.renderCallback} options.render
     * @param {Number} options.z    Optional, if specified used to control the render order. Larger z items are drawn on top, like css z index.
     *                              If not supplied then items are rendered in the order they are added to the tile source.
     */
    $.Renderable = function( options ) {

        if(options.location instanceof $.Rect) {
            this.bounds = options.location;
        } else {
            this.bounds     = new $.Rect(
                options.location.x,
                options.location.y,
                options.location.width,
                options.location.height
            );
        }

        /**
         * render callback signature used by {@link OpenSeadragon.Renderable}.
         *
         * Position and size are supplied as pixel dimensions.
         * Note, the context is saved and restored by the calling code, Layers are not required
         * to save and restore the context themselves
         *
         * @callback renderCallback
         * @memberof OpenSeadragon.Renderable
         * @param {Context2D} context
         * @param {OpenSeadragon.Rect} pixelBounds
         */
        this.render = options.render;

        if(options.z !== undefined) {
            this.z = options.z;
        } else {
            this.z = 0;
        }
    };

    $.Renderable.prototype = /** @lends OpenSeadragon.Renderable.prototype */{

        render:function(context2d, pixelBounds) {
            // Stub, just draws the bounds
            context2d.lineWidth = 1;
            context2d.strokeStyle = "#FF0000";
            context2d.strokeRect(pixelBounds.x,pixelBounds.y, pixelBounds.width, pixelBounds.height);
        }
    };

}( OpenSeadragon ));
