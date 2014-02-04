/**
 * Created by martin on 2/2/14.
 */


(function( $ ){

    var TILE_CACHE       = {};

    $.TileCanvasRenderer = function() {
        $.console.log('New TileCanvasRenderer');
        this.offsetX = 0;
        this.offsetY = 0;
    };

    $.TileCanvasRenderer.prototype = {
        render: function(tile, context) {
            var position = tile.position,
                size     = tile.size,
                rendered,
                canvas;

            if ( !tile.loaded || !( tile.image || TILE_CACHE[ tile.url ] ) ){
                $.console.warn(
                    "Attempting to draw tile %s when it's not yet loaded.",
                    this.toString()
                );
                return;
            }
            context.globalAlpha = tile.opacity;

            //context.save();

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
                rendered.drawImage( tile.image, 0, 0 );
                TILE_CACHE[ tile.url ] = rendered;
                //since we are caching the prerendered image on a canvas
                //allow the image to not be held in memory
                tile.image = null;
            } else {
                rendered = TILE_CACHE[ tile.url ];
            }

            //rendered.save();
            context.drawImage(
                rendered.canvas,
                0,
                0,
                rendered.canvas.width,
                rendered.canvas.height,
                position.x + this.offsetX,
                position.y + this.offsetY,
                size.x,
                size.y
            );
            //rendered.restore();

            //context.restore();

        },
        unload: function(tile) {
            if ( TILE_CACHE[ tile.url ]){
                delete TILE_CACHE[ tile.url ];
            }
        },

        debug:function(drawer, tile, count, i) {
            drawer.context.save();
            drawer.context.lineWidth = 2;
            drawer.context.font = 'small-caps bold 13px ariel';
            drawer.context.strokeStyle = drawer.debugGridColor;
            drawer.context.fillStyle = drawer.debugGridColor;
            drawer.context.strokeRect(
                tile.position.x,
                tile.position.y,
                tile.size.x,
                tile.size.y
            );
            if( tile.x === 0 && tile.y === 0 ){
                drawer.context.fillText(
                    "Zoom: " + drawer.viewport.getZoom(),
                    tile.position.x,
                    tile.position.y - 30
                );
                drawer.context.fillText(
                    "Pan: " + drawer.viewport.getBounds().toString(),
                    tile.position.x,
                    tile.position.y - 20
                );
            }
            drawer.context.fillText(
                "Level: " + tile.level,
                tile.position.x + 10,
                tile.position.y + 20
            );
            drawer.context.fillText(
                "Column: " + tile.x,
                tile.position.x + 10,
                tile.position.y + 30
            );
            drawer.context.fillText(
                "Row: " + tile.y,
                tile.position.x + 10,
                tile.position.y + 40
            );
            drawer.context.fillText(
                "Order: " + i + " of " + count,
                tile.position.x + 10,
                tile.position.y + 50
            );
            drawer.context.fillText(
                "Size: " + tile.size.toString(),
                tile.position.x + 10,
                tile.position.y + 60
            );
            drawer.context.fillText(
                "Position: " + tile.position.toString(),
                tile.position.x + 10,
                tile.position.y + 70
            );
            drawer.context.restore();
        }
    };
}( OpenSeadragon ));
