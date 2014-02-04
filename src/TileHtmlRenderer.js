/**
 * Created by martin on 2/2/14.
 */


(function( $ ){

    $.TileHtmlRenderer = function() {
    };

    $.TileHtmlRenderer.prototype = {
        render: function(tile, container) {
            if ( !tile.loaded || !tile.image ) {
                $.console.warn(
                    "Attempting to draw tile %s when it's not yet loaded.",
                    tile.toString()
                );
                return;
            }

            //EXPERIMENTAL - trying to figure out how to scale the container
            //               content during animation of the container size.

            if ( !tile.element ) {
                tile.element                              = $.makeNeutralElement( "div" );
                tile.imgElement                           = $.makeNeutralElement( "img" );
                tile.imgElement.src                       = tile.url;
                tile.imgElement.style.msInterpolationMode = "nearest-neighbor";
                tile.imgElement.style.width               = "100%";
                tile.imgElement.style.height              = "100%";

                tile.style                     = tile.element.style;
                tile.style.position            = "absolute";
            }
            if ( tile.element.parentNode != container ) {
                container.appendChild( tile.element );
            }
            if ( tile.imgElement.parentNode != tile.element ) {
                tile.element.appendChild( tile.imgElement );
            }

            tile.style.top     = tile.position.y + "px";
            tile.style.left    = tile.position.x + "px";
            tile.style.height  = tile.size.y + "px";
            tile.style.width   = tile.size.x + "px";

            $.setElementOpacity( tile.element, tile.opacity );
        },
        unload:function(tile) {
            if ( tile.imgElement && tile.imgElement.parentNode ) {
                tile.imgElement.parentNode.removeChild( tile.imgElement );
            }
            if ( tile.element && tile.element.parentNode ) {
                tile.element.parentNode.removeChild( tile.element );
            }

            tile.element    = null;
            tile.imgElement = null;
        }
    };
}( OpenSeadragon ));
