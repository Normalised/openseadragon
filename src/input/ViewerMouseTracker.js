/*
 * OpenSeadragon - ViewerMouseTracker
 *
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
     * @class ViewerMouseTracker
     * @memberof OpenSeadragon
     */
    $.ViewerMouseTracker = function(config) {

        $.EventSource.call( this );

        $.extend(this,config);
//        this.canvas = config.canvas;
//        this.clickTimeThreshold = config.clickTimeThreshold;
//        this.clickDistThreshold = config.clickDistThreshold;
//        this.mouseNavEnabled = config.mouseNavEnabled;
//        this.container = config.container;
//        this.zoomPerClick = config.zoomPerClick;
//        // TODO : This is a horrible binding, just listen for events
//        this.viewport = config.viewport;

        this.innerTracker = new $.MouseTracker({
            element:            this.canvas,
            clickTimeThreshold: this.clickTimeThreshold,
            clickDistThreshold: this.clickDistThreshold,
            clickHandler:       $.delegate( this, this.onCanvasClick ),
            dragHandler:        $.delegate( this, this.onCanvasDrag ),
            releaseHandler:     $.delegate( this, this.onCanvasRelease ),
            scrollHandler:      $.delegate( this, this.onCanvasScroll )
        }).setTracking( this.mouseNavEnabled ? true : false ); // default state

        this.outerTracker = new $.MouseTracker({
            element:            this.container,
            clickTimeThreshold: this.clickTimeThreshold,
            clickDistThreshold: this.clickDistThreshold,
            enterHandler:       $.delegate( this, this.onContainerEnter ),
            exitHandler:        $.delegate( this, this.onContainerExit ),
            releaseHandler:     $.delegate( this, this.onContainerRelease )
        }).setTracking( this.mouseNavEnabled ? true : false ); // always tracking

    };

    $.extend($.ViewerMouseTracker.prototype, $.EventSource.prototype, {
        onCanvasClick:function( event ) {
            $.console.log('onCanvasClick %O %s',this,this.zoomPerClick);
            var zoomPerClick,
                factor;
            if ( !event.preventDefaultAction && this.viewport && event.quick ) {    // ignore clicks where mouse moved
                zoomPerClick = this.zoomPerClick;
                factor = event.shift ? 1.0 / zoomPerClick : zoomPerClick;
                this.viewport.zoomBy(
                    factor,
                    this.viewport.pointFromPixel( event.position, true )
                );
                this.viewport.applyConstraints();
            }

            this.raiseEvent( 'canvas-click', {
                tracker: event.eventSource,
                position: event.position,
                quick: event.quick,
                shift: event.shift,
                originalEvent: event.originalEvent
            });
        },
        onCanvasDrag:function( event ) {
            if ( !event.preventDefaultAction && this.viewport ) {
                if( !this.panHorizontal ){
                    event.delta.x = 0;
                }
                if( !this.panVertical ){
                    event.delta.y = 0;
                }
                this.viewport.panBy(
                    this.viewport.deltaPointsFromPixels(
                        event.delta.negate()
                    )
                );
                if( this.constrainDuringPan ){
                    this.viewport.applyConstraints();
                }
            }
            /**
             * Raised when a mouse or touch drag operation occurs on the {@link OpenSeadragon.Viewer#canvas} element.
             *
             * @event canvas-drag
             * @memberof OpenSeadragon.Viewer
             * @type {object}
             * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised this event.
             * @property {OpenSeadragon.MouseTracker} tracker - A reference to the MouseTracker which originated this event.
             * @property {OpenSeadragon.Point} position - The position of the event relative to the tracked element.
             * @property {OpenSeadragon.Point} delta - The x,y components of the difference between start drag and end drag.
             * @property {Boolean} shift - True if the shift key was pressed during this event.
             * @property {Object} originalEvent - The original DOM event.
             * @property {?Object} userData - Arbitrary subscriber-defined object.
             */
            this.raiseEvent( 'canvas-drag', {
                tracker: event.eventSource,
                position: event.position,
                delta: event.delta,
                shift: event.shift,
                originalEvent: event.originalEvent
            });
        },
        onCanvasRelease:function( event ) {
            if ( event.insideElementPressed && this.viewport ) {
                this.viewport.applyConstraints();
            }
            /**
             * Raised when the mouse button is released or touch ends on the {@link OpenSeadragon.Viewer#canvas} element.
             *
             * @event canvas-release
             * @memberof OpenSeadragon.Viewer
             * @type {object}
             * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised this event.
             * @property {OpenSeadragon.MouseTracker} tracker - A reference to the MouseTracker which originated this event.
             * @property {OpenSeadragon.Point} position - The position of the event relative to the tracked element.
             * @property {Boolean} insideElementPressed - True if the left mouse button is currently being pressed and was initiated inside the tracked element, otherwise false.
             * @property {Boolean} insideElementReleased - True if the cursor still inside the tracked element when the button was released.
             * @property {Object} originalEvent - The original DOM event.
             * @property {?Object} userData - Arbitrary subscriber-defined object.
             */
            this.raiseEvent( 'canvas-release', {
                tracker: event.eventSource,
                position: event.position,
                insideElementPressed: event.insideElementPressed,
                insideElementReleased: event.insideElementReleased,
                originalEvent: event.originalEvent
            });
        },
        onCanvasScroll:function( event ) {
            var factor;
            if ( !event.preventDefaultAction && this.viewport ) {
                factor = Math.pow( this.zoomPerScroll, event.scroll );
                this.viewport.zoomBy(
                    factor,
                    this.viewport.pointFromPixel( event.position, true )
                );
                this.viewport.applyConstraints();
            }

            this.raiseEvent( 'canvas-scroll', {
                tracker: event.eventSource,
                position: event.position,
                scroll: event.scroll,
                shift: event.shift,
                originalEvent: event.originalEvent
            });
            //cancels event
            return false;
        },
        onContainerExit:function( event ) {
            if ( !event.insideElementPressed ) {
                this.mouseInside = false;
                // TODO : Viewer should listen for container-exit and handle this
//                if ( !ViewerStateMap[ this.hash ].animating ) {
//                    this.beginControlsAutoHide();
//                }
            }

            if(event !== null) {
                this.raiseEvent( 'container-exit', {
                    tracker: event.eventSource,
                    position: event.position,
                    insideElementPressed: event.insideElementPressed,
                    buttonDownAny: event.buttonDownAny,
                    originalEvent: event.originalEvent
                });
            }
        },
        onContainerRelease:function( event ) {
            if ( !event.insideElementReleased ) {
                this.mouseInside = false;
                // TODO : Viewer should listen for container-release and handle this
//                if ( !ViewerStateMap[ this.hash ].animating ) {
//                    this.beginControlsAutoHide();
//                }
            }

            this.raiseEvent( 'container-release', {
                tracker: event.eventSource,
                position: event.position,
                insideElementPressed: event.insideElementPressed,
                insideElementReleased: event.insideElementReleased,
                originalEvent: event.originalEvent
            });
        },
        onContainerEnter:function( event ) {
            // TODO : Viewer should listen for container-enter and handle this
//            ViewerStateMap[ this.hash ].mouseInside = true;
//            abortControlsAutoHide( this );

            if(event !== null) {
                this.raiseEvent( 'container-enter', {
                    tracker: event.eventSource,
                    position: event.position,
                    insideElementPressed: event.insideElementPressed,
                    buttonDownAny: event.buttonDownAny,
                    originalEvent: event.originalEvent
                });
            }
        },
        destroy:function() {
            if (this.innerTracker){
                this.innerTracker.destroy();
            }
            if (this.outerTracker){
                this.outerTracker.destroy();
            }
        }

    });

}( OpenSeadragon ));
