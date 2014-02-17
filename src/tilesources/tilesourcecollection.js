/*
 * OpenSeadragon - TileSourceCollection
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
 * @class TileSourceCollection
 * @memberof OpenSeadragon
 * @extends OpenSeadragon.TileSource
 */
$.TileSourceCollection = function( options ) {

    if(options.tileSources === null) {
        throw new Error('No Tile Sources provided for collection');
    }

    $.console.log('Create TileSourceCollection : %O', options);

    if(!$.isArray(options.tileSources)) {
      options.tileSources = [options.tileSources];
    }

    var isHorizontal = true;

    if( !options.layout ){
        options.layout = $.LAYOUT.HORIZONTAL;
    } else {
        isHorizontal = options.layout == $.LAYOUT.HORIZONTAL;
    }

    // Call the TileSource constructor with 'this' as the context, a.k.a super(options)
    // As per most OSD constructor functions this will merge the options with 'this' object so
    // that the options become instance properties
    $.TileSource.apply( this, [ options ] );

    // Calculate complete width / height
    var w = isHorizontal ? 0 : this.tileSources[0].dimensions.x;
    var h = isHorizontal ? this.tileSources[0].dimensions.y : 0;
    var ts = null;
    for(var i=0;i<this.tileSources.length;i++) {
        ts = this.tileSources[i];
        if(isHorizontal) {
            w += ts.dimensions.x;
            if(ts.dimensions.y > h) {
                h = ts.dimensions.y;
            }
        } else {
            h += ts.dimensions.y;
            if(ts.dimensions.x > w) {
                w = ts.dimensions.x;
            }
        }
    }
    // Add margin
    if(this.margin) {
        if(isHorizontal) {
            w += this.margin * (this.tileSources.length - 1);
        } else {
            h += this.margin * (this.tileSources.length - 1);
        }
    }
    this.dimensions = new $.Point(w,h);
    $.console.log('Calculated Collection Dimensions %s', this.dimensions.toString());
};

//$.extend( $.TileSourceCollection.prototype, $.TileSource.prototype);

}( OpenSeadragon ));
