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

/* global Q */

/**
 * @class TileSourceFactory
 * @memberof OpenSeadragon
 */
$.TileSourceFactory = {

    log: $.logFactory.getLogger('osd.tileSourceFactory'),
    /**
     *
     * Create a TileSource instance from any type of tile source description
     *
     * @return A Q promise.
     *
     * The configurator can eventually be changed to simple options :
     * collectionMode : true / false
     *
     * But first have to work out exactly what this line does :
     * var options = $TileSource.prototype.configure.apply( configurator, [ tileSource ]);
     *
     * At the moment the 'configurator' is always the viewer which is calling create.
     */
    create:function(configurator, tileSource) {
        this.log.log('TileSourceFactory::create %O',tileSource);

        // If the tileSource is an array with only 1 item then just remap the single item back into tileSource
        if($.isArray(tileSource)) {
            if(tileSource.length == 1) {
                tileSource = tileSource[0];
            } else {
                // There are multiple sources, each of which may need converting into TileSource instances
                this.log.log('Tile Source Descriptor is an array of sources. %O',tileSource);
                var sourcePromises = [];
                for(var i=0;i<tileSource.length;i++) {
                    sourcePromises.push(this.createTileSourceFromDescriptor(tileSource[i],configurator));
                }
                return Q.all(sourcePromises);
            }
        }

        return this.createTileSourceFromDescriptor(tileSource);

    },
    createTileSourceFromDescriptor:function(tileSource, configurator) {

        this.log.log('Create Tile Source from Descriptor %s',tileSource);
        var deferred = Q.defer();

        if ( $.type( tileSource ) == 'string') {
            this.log.log('Tile Source is a string, assuming URL : %s',tileSource);
            //If its still a string it means it must be a url at this point
            tileSource = new $.TileSource( tileSource, function( event ){
                deferred.resolve(event.tileSource);
            });
            tileSource.addHandler( 'open-failed', function ( event ) {
                deferred.reject(event.tileSource);
            });


        } else if ( $.isPlainObject( tileSource ) || tileSource.nodeType ){
            if( $.isFunction( tileSource.getTileUrl ) ){
                //Custom tile source
                var customTileSource = new $.TileSource(tileSource);
                customTileSource.getTileUrl = tileSource.getTileUrl;
                deferred.resolve(customTileSource);
            } else {
                //inline configuration
                var $TileSource = $.TileSource.determineType( tileSource );
                if ( !$TileSource ) {
                    $.console.warn('Rejecting tilesource promise %O', tileSource);
                    deferred.reject(tileSource);
                }
                var options = $TileSource.prototype.configure.apply( configurator, [ tileSource ]);
                var readySource = new $TileSource( options );
                deferred.resolve(readySource);
            }
        } else {
             this.log.log('Supplied source is already a TileSource. %O',tileSource);
            //can assume it's already a tile source implementation
            deferred.resolve(tileSource);
        }
        return deferred.promise;
    }
};

}( OpenSeadragon ));
