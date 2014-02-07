/*
 * OpenSeadragon - ViewerControls
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

    // This state map setup isn't pleasant. Find a way to remove it.
    var ViewerStateMap;
    /**
     * @class ViewerControls
     * @memberof OpenSeadragon
     */
    $.ViewerControls = function(viewer, stateMap){
        this.viewer = viewer;
        this.hash = viewer.hash;
        ViewerStateMap = stateMap;
        this.onFocusHandler = $.delegate( this, this.onFocus );
        this.onBlurHandler  = $.delegate( this, this.onBlur );
        this.zoomFrameHandler = $.delegate( this, this.doZoom );
        this.zooming = false;
        this.lastZoomTime = 0;
        this.zoomFactor = 1;
        this.zoomPerSecond = viewer.zoomPerSecond;
    };

    $.ViewerControls.prototype = {

        resolveUrl:function( prefix, url ) {
            return prefix ? prefix + url : url;
        },
        setupBindings:function() {
          this.bindStandardControls(this.viewer);
          this.bindSequenceControls(this.viewer);
        },
        bindStandardControls:function(viewer) {

            $.console.log('Bind Standard Viewer controls %O',viewer);

            //////////////////////////////////////////////////////////////////////////
            // Navigation Controls
            //////////////////////////////////////////////////////////////////////////
            var beginZoomingInHandler   = $.delegate( this, this.beginZoomingIn ),
                endZoomingHandler       = $.delegate( this, this.endZooming ),
                doSingleZoomInHandler   = $.delegate( this, this.doSingleZoomIn ),
                beginZoomingOutHandler  = $.delegate( this, this.beginZoomingOut ),
                doSingleZoomOutHandler  = $.delegate( this, this.doSingleZoomOut ),
                onHomeHandler           = $.delegate( this, this.onHome ),
                onFullScreenHandler     = $.delegate( this, this.onFullScreen ),
                navImages               = viewer.navImages,
                buttons                 = [],
                useGroup                = true ;


            if( viewer.showNavigationControl ){

                if( viewer.zoomInButton || viewer.zoomOutButton || viewer.homeButton || viewer.fullPageButton ){
                    //if we are binding to custom buttons then layout and
                    //grouping is the responsibility of the page author
                    useGroup = false;
                }

                buttons.push( viewer.zoomInButton = new $.Button({
                    element:    viewer.zoomInButton ? $.getElement( viewer.zoomInButton ) : null,
                    clickTimeThreshold: viewer.clickTimeThreshold,
                    clickDistThreshold: viewer.clickDistThreshold,
                    tooltip:    $.getString( "Tooltips.ZoomIn" ),
                    srcRest:    this.resolveUrl( viewer.prefixUrl, navImages.zoomIn.REST ),
                    srcGroup:   this.resolveUrl( viewer.prefixUrl, navImages.zoomIn.GROUP ),
                    srcHover:   this.resolveUrl( viewer.prefixUrl, navImages.zoomIn.HOVER ),
                    srcDown:    this.resolveUrl( viewer.prefixUrl, navImages.zoomIn.DOWN ),
                    onPress:    beginZoomingInHandler,
                    onRelease:  endZoomingHandler,
                    onClick:    doSingleZoomInHandler,
                    onEnter:    beginZoomingInHandler,
                    onExit:     endZoomingHandler,
                    onFocus:    this.onFocusHandler,
                    onBlur:     this.onBlurHandler
                }));

                buttons.push( viewer.zoomOutButton = new $.Button({
                    element:    viewer.zoomOutButton ? $.getElement( viewer.zoomOutButton ) : null,
                    clickTimeThreshold: viewer.clickTimeThreshold,
                    clickDistThreshold: viewer.clickDistThreshold,
                    tooltip:    $.getString( "Tooltips.ZoomOut" ),
                    srcRest:    this.resolveUrl( viewer.prefixUrl, navImages.zoomOut.REST ),
                    srcGroup:   this.resolveUrl( viewer.prefixUrl, navImages.zoomOut.GROUP ),
                    srcHover:   this.resolveUrl( viewer.prefixUrl, navImages.zoomOut.HOVER ),
                    srcDown:    this.resolveUrl( viewer.prefixUrl, navImages.zoomOut.DOWN ),
                    onPress:    beginZoomingOutHandler,
                    onRelease:  endZoomingHandler,
                    onClick:    doSingleZoomOutHandler,
                    onEnter:    beginZoomingOutHandler,
                    onExit:     endZoomingHandler,
                    onFocus:    this.onFocusHandler,
                    onBlur:     this.onBlurHandler
                }));

                buttons.push( viewer.homeButton = new $.Button({
                    element:    viewer.homeButton ? $.getElement( viewer.homeButton ) : null,
                    clickTimeThreshold: viewer.clickTimeThreshold,
                    clickDistThreshold: viewer.clickDistThreshold,
                    tooltip:    $.getString( "Tooltips.Home" ),
                    srcRest:    this.resolveUrl( viewer.prefixUrl, navImages.home.REST ),
                    srcGroup:   this.resolveUrl( viewer.prefixUrl, navImages.home.GROUP ),
                    srcHover:   this.resolveUrl( viewer.prefixUrl, navImages.home.HOVER ),
                    srcDown:    this.resolveUrl( viewer.prefixUrl, navImages.home.DOWN ),
                    onRelease:  onHomeHandler,
                    onFocus:    this.onFocusHandler,
                    onBlur:     this.onBlurHandler
                }));

                buttons.push( viewer.fullPageButton = new $.Button({
                    element:    viewer.fullPageButton ? $.getElement( viewer.fullPageButton ) : null,
                    clickTimeThreshold: viewer.clickTimeThreshold,
                    clickDistThreshold: viewer.clickDistThreshold,
                    tooltip:    $.getString( "Tooltips.FullPage" ),
                    srcRest:    this.resolveUrl( viewer.prefixUrl, navImages.fullpage.REST ),
                    srcGroup:   this.resolveUrl( viewer.prefixUrl, navImages.fullpage.GROUP ),
                    srcHover:   this.resolveUrl( viewer.prefixUrl, navImages.fullpage.HOVER ),
                    srcDown:    this.resolveUrl( viewer.prefixUrl, navImages.fullpage.DOWN ),
                    onRelease:  onFullScreenHandler,
                    onFocus:    this.onFocusHandler,
                    onBlur:     this.onBlurHandler
                }));

                if( useGroup ){
                    viewer.buttons = new $.ButtonGroup({
                        buttons:            buttons,
                        clickTimeThreshold: viewer.clickTimeThreshold,
                        clickDistThreshold: viewer.clickDistThreshold
                    });

                    viewer.navControl  = viewer.buttons.element;
                    viewer.addHandler( 'open', $.delegate( this, this.lightUp ) );

                    if( viewer.toolbar ){
                        viewer.toolbar.addControl(
                            viewer.navControl,
                            {anchor: $.ControlAnchor.TOP_LEFT}
                        );
                    }else{
                        viewer.addControl(
                            viewer.navControl,
                            {anchor: viewer.navigationControlAnchor || $.ControlAnchor.TOP_LEFT}
                        );
                    }
                }

            }
            return viewer;
        },
        bindSequenceControls:function(viewer) {

            //////////////////////////////////////////////////////////////////////////
            // Image Sequence Controls
            //////////////////////////////////////////////////////////////////////////
            var onNextHandler           = $.delegate( this, this.onNext ),
                onPreviousHandler       = $.delegate( this, this.onPrevious ),
                navImages               = viewer.navImages,
                useGroup                = true ;

            if( viewer.showSequenceControl && ViewerStateMap[ viewer.hash ].sequenced ){

                if( viewer.previousButton || viewer.nextButton ){
                    //if we are binding to custom buttons then layout and
                    //grouping is the responsibility of the page author
                    useGroup = false;
                }

                viewer.previousButton = new $.Button({
                    element:    viewer.previousButton ? $.getElement( viewer.previousButton ) : null,
                    clickTimeThreshold: viewer.clickTimeThreshold,
                    clickDistThreshold: viewer.clickDistThreshold,
                    tooltip:    $.getString( "Tooltips.PreviousPage" ),
                    srcRest:    this.resolveUrl( viewer.prefixUrl, navImages.previous.REST ),
                    srcGroup:   this.resolveUrl( viewer.prefixUrl, navImages.previous.GROUP ),
                    srcHover:   this.resolveUrl( viewer.prefixUrl, navImages.previous.HOVER ),
                    srcDown:    this.resolveUrl( viewer.prefixUrl, navImages.previous.DOWN ),
                    onRelease:  onPreviousHandler,
                    onFocus:    this.onFocusHandler,
                    onBlur:     this.onBlurHandler
                });

                viewer.nextButton = new $.Button({
                    element:    viewer.nextButton ? $.getElement( viewer.nextButton ) : null,
                    clickTimeThreshold: viewer.clickTimeThreshold,
                    clickDistThreshold: viewer.clickDistThreshold,
                    tooltip:    $.getString( "Tooltips.NextPage" ),
                    srcRest:    this.resolveUrl( viewer.prefixUrl, navImages.next.REST ),
                    srcGroup:   this.resolveUrl( viewer.prefixUrl, navImages.next.GROUP ),
                    srcHover:   this.resolveUrl( viewer.prefixUrl, navImages.next.HOVER ),
                    srcDown:    this.resolveUrl( viewer.prefixUrl, navImages.next.DOWN ),
                    onRelease:  onNextHandler,
                    onFocus:    this.onFocusHandler,
                    onBlur:     this.onBlurHandler
                });

                if( !viewer.navPrevNextWrap ){
                    viewer.previousButton.disable();
                }

                if( useGroup ){
                    viewer.paging = new $.ButtonGroup({
                        buttons: [
                            viewer.previousButton,
                            viewer.nextButton
                        ],
                        clickTimeThreshold: viewer.clickTimeThreshold,
                        clickDistThreshold: viewer.clickDistThreshold
                    });

                    viewer.pagingControl = viewer.paging.element;

                    if(!viewer.noControlDock) {
                        if( viewer.toolbar ){
                            viewer.toolbar.addControl(
                                viewer.pagingControl,
                                {anchor: $.ControlAnchor.BOTTOM_RIGHT}
                            );
                        }else{
                            viewer.addControl(
                                viewer.pagingControl,
                                {anchor: viewer.sequenceControlAnchor || $.ControlAnchor.TOP_LEFT}
                            );
                        }
                    }
                }
            }
            return viewer;
        },
        bindKeyControls:function() {
            $.console.log('Bind Key Controls to Viewer %O',this.viewer);
            var viewport = this.viewer.viewport;

            return new $.MouseTracker({
                viewport : viewport,
                element:            this.viewer.keyboardCommandArea,
                focusHandler:       function( event ){
                    if ( !event.preventDefaultAction ) {
                        var point    = $.getElementPosition( this.viewer.element );
                        window.scrollTo( 0, point.y );
                    }
                },

                keyHandler:         function( event ){
                    if ( !event.preventDefaultAction ) {
                        switch( event.keyCode ){
                            case 61://=|+
                                viewport.zoomBy(1.1);
                                viewport.applyConstraints();
                                return false;
                            case 45://-|_
                                viewport.zoomBy(0.9);
                                viewport.applyConstraints();
                                return false;
                            case 48://0|)
                                viewport.goHome();
                                viewport.applyConstraints();
                                return false;
                            case 119://w
                            case 87://W
                            case 38://up arrow
                                if ( event.shift ) {
                                    viewport.zoomBy(1.1);
                                } else {
                                    viewport.panBy(new $.Point(0, -0.05));
                                }
                                viewport.applyConstraints();
                                return false;
                            case 115://s
                            case 83://S
                            case 40://down arrow
                                if ( event.shift ) {
                                    viewport.zoomBy(0.9);
                                } else {
                                    viewport.panBy(new $.Point(0, 0.05));
                                }
                                viewport.applyConstraints();
                                return false;
                            case 97://a
                            case 37://left arrow
                                viewport.panBy(new $.Point(-0.05, 0));
                                viewport.applyConstraints();
                                return false;
                            case 100://d
                            case 39://right arrow
                                viewport.panBy(new $.Point(0.05, 0));
                                viewport.applyConstraints();
                                return false;
                            default:
                                //console.log( 'navigator keycode %s', event.keyCode );
                                return true;
                        }
                    }
                }
            }).setTracking( true ); // default state
        },
        beginZoomingIn:function() {
            $.console.log('Begin Zooming In. State Map %O',ViewerStateMap);
            this.lastZoomTime = $.now();
            this.zoomFactor = this.zoomPerSecond;
            this.zooming = true;
            this.scheduleZoom();
        },
        beginZoomingOut:function() {
            this.lastZoomTime = $.now();
            this.zoomFactor = 1.0 / this.zoomPerSecond;
            this.zooming = true;
            this.scheduleZoom();
        },
        endZooming:function() {
            this.zooming = false;
        },
        scheduleZoom:function() {
            $.console.log("Schedule Zoom for Viewer : %O", this.viewer);
            $.requestAnimationFrame( this.zoomFrameHandler );
        },
        doSingleZoomIn:function() {
            if ( this.viewer.viewport ) {
                this.zooming = false;
                this.viewer.viewport.zoomBy(
                    this.viewer.zoomPerClick / 1.0
                );
                this.viewer.viewport.applyConstraints();
            }
        },
        doSingleZoomOut:function() {
            if ( this.viewer.viewport ) {
                this.zooming = false;
                this.viewer.viewport.zoomBy(
                    1.0 / this.viewer.zoomPerClick
                );
                this.viewer.viewport.applyConstraints();
            }
        },
        onHome:function() {
            $.console.log('On Home %O', this);
            if ( this.viewer.viewport ) {
                this.viewer.viewport.goHome();
            }
        },
        onFullScreen:function() {
            if ( this.viewer.isFullPage() && !$.isFullScreen() ) {
                // Is fullPage but not fullScreen
                this.viewer.setFullPage( false );
            } else {
                this.viewer.setFullScreen( !this.viewer.isFullPage() );
            }
            // correct for no mouseout event on change
            if ( this.viewer.buttons ) {
                this.viewer.buttons.emulateExit();
            }
            this.viewer.fullPageButton.element.focus();
            if ( this.viewer.viewport ) {
                this.viewer.viewport.applyConstraints();
            }
        },
        onPrevious:function(){
            var previous = ViewerStateMap[ this.hash ].sequenceIndex - 1;
            if(this.navPrevNextWrap && previous < 0){
                previous += this.viewer.tileSources.length;
            }
            this.goToPage( previous );
        },
        onNext:function(){
            var next = ViewerStateMap[ this.hash ].sequenceIndex + 1;
            if(this.navPrevNextWrap && next >= this.viewer.tileSources.length){
                next = 0;
            }
            this.goToPage( next );
        },
        onFocus:function() {
            $.console.log('On Focus %O', this);
            this.viewer.abortControlsAutoHide();
        },
        onBlur:function() {
            $.console.log('On Blur %O', this);
            this.viewer.beginControlsAutoHide();
        },
        lightUp:function() {
            this.viewer.buttons.emulateEnter();
            this.viewer.buttons.emulateExit();
        },
        doZoom:function() {
            var currentTime,
                deltaTime,
                adjustedFactor;

            if ( this.zooming && this.viewer.viewport) {
                currentTime     = $.now();
                deltaTime       = currentTime - this.lastZoomTime;
                adjustedFactor  = Math.pow( this.zoomFactor, deltaTime * 0.001);
                this.viewer.viewport.zoomBy( adjustedFactor );
                this.viewer.viewport.applyConstraints();
                this.lastZoomTime = currentTime;
                $.requestAnimationFrame( this.zoomFrameHandler );
            }
        }
    };
}( OpenSeadragon ));
