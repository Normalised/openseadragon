/**
 * Created by martin on 2/2/14.
 */


(function( $ ){

    var TILE_CACHE       = {};

    var DEFAULTS = {
        debugGridColor:"#437AB2",
        debugTextColor:"#FF0000"
    };

    $.TileCanvasRenderer = function(options) {
        this.log = $.logFactory.getLogger('osd.tileCanvasRenderer');

        if(options === null) {
            options = {};
        }

        $.extend(this, DEFAULTS, options);
    };

    $.TileCanvasRenderer.prototype = {
        render: function(tile, context) {
            var position = tile.position,
                size     = tile.size,
                rendered,
                canvas;

            if ( !tile.loaded || !( tile.image || TILE_CACHE[ tile.url ] ) ){
                this.log.warn("Attempting to draw tile %s when it's not yet loaded.",this.toString());
                return;
            }
            if(this.margin) {
                position.x += this.margin.x;
                position.y += this.margin.y;
            }
            context.globalAlpha = tile.opacity;

            //if we are supposed to be rendering fully opaque rectangle,
            //ie its done fading or fading is turned off, and if we are drawing
            //an image with an alpha channel, then the only way
            //to avoid seeing the tile underneath is to clear the rectangle
            if( context.globalAlpha == 1 && tile.isPNG ){
                //clearing only the inside of the rectangle occupied
                //by the png prevents edge flickering
                context.clearRect(
                    position.x+1,
                    position.y+1,
                    size.x-2,
                    size.y-2
                );

            }

            if( !TILE_CACHE[ tile.url ] ){
                canvas = document.createElement( 'canvas' );
                canvas.width = tile.image.width;
                canvas.height = tile.image.height;
                rendered = canvas.getContext('2d');
                // This causes an error in IE11 after the DOM7009: Unable to decode image at URL error appears
                try {
                    rendered.drawImage( tile.image, 0, 0 );
                    TILE_CACHE[ tile.url ] = rendered;
                    //since we are caching the prerendered image on a canvas
                    //allow the image to not be held in memory
                    tile.image = null;

                } catch (e) {
                    // this.log.warn('Error rendering tile');
                    return;
                }
            } else {
                rendered = TILE_CACHE[ tile.url ];
            }

            if(this.debugMode) {
                context.save();
                context.globalAlpha = 0.5;
                context.restore();
            } else {
                context.drawImage( rendered.canvas, 0, 0, rendered.canvas.width, rendered.canvas.height, position.x, position.y, size.x, size.y );
            }
        },
        unload: function(tile) {
            if ( TILE_CACHE[ tile.url ]){
                delete TILE_CACHE[ tile.url ];
            }
        },

        debug:function(drawer, tile, count, i) {
            drawer.context.save();
            drawer.context.lineWidth = 2;
            drawer.context.font = 'bold small-caps 12px inconsolata';
            drawer.context.strokeStyle = this.debugGridColor;
            drawer.context.fillStyle = "#44AAFF";

            var tx = tile.position.x;
            var ty = tile.position.y;

            drawer.context.strokeRect(
                tx,ty,
                tile.size.x,
                tile.size.y
            );
            drawer.context.fillText(
                "Level: " + tile.level,
                tx + 10,
                ty + 20
            );
            drawer.context.fillText(
                "Column: " + tile.x,
                tx + 10,
                ty + 30
            );
            drawer.context.fillText(
                "Row: " + tile.y,
                tx + 10,
                ty + 40
            );
            drawer.context.fillText(
                "Order: " + i + " of " + count,
                tx + 10,
                ty + 50
            );
            drawer.context.fillText(
                "Size: " + tile.size.toStringRounded(true),
                tx + 10,
                ty + 60
            );
            drawer.context.fillText(
                "Position: " + tile.position.toStringRounded(true),
                tx + 10,
                ty + 70
            );
            drawer.context.fillText(
                "Bounds: " + tile.bounds.toStringRounded(),
                tx + 10,
                ty + 80
            );

            drawer.context.restore();
        }
    };
}( OpenSeadragon ));
