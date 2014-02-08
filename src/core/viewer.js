/*
 * OpenSeadragon - Viewer
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

// dictionary from hash to private properties
var ViewerStateMap = {},

// We keep a list of viewers so we can 'wake-up' each viewer on
// a page after toggling between fullpage modes
VIEWERS = {};

/**
 *
 * The main point of entry into creating a zoomable image on the page.
 *
 * We have provided an idiomatic javascript constructor which takes
 * a single object, but still support the legacy positional arguments.
 *
 * The options below are given in order that they appeared in the constructor
 * as arguments and we translate a positional call into an idiomatic call.
 *
 * @class Viewer
 * @classdesc The main OpenSeadragon viewer class.
 *
 * @memberof OpenSeadragon
 * @extends OpenSeadragon.EventSource
 * @extends OpenSeadragon.ControlDock
 * @param {OpenSeadragon.Options} options - Viewer options.
 *
 **/
$.Viewer = function( options ) {

    $.console.log('Create Viewer %O', options);

    var args  = arguments,
        _this = this,
        i;


    //Public properties
    //Allow the options object to override global defaults
    $.extend( true, this, {

        //internal state and dom identifiers
        id:             options.id,
        hash:           options.hash || options.id,

        //dom nodes
        /**
         * The parent element of this Viewer instance, passed in when the Viewer was created.
         * @member {Element} element
         * @memberof OpenSeadragon.Viewer#
         */
        element:        null,
        /**
         * A &lt;form&gt; element (provided by {@link OpenSeadragon.ControlDock}), the base element of this Viewer instance.<br><br>
         * Child element of {@link OpenSeadragon.Viewer#element}.
         * @member {Element} container
         * @memberof OpenSeadragon.Viewer#
         */
        container:      null,
        /**
         * A &lt;textarea&gt; element, the element where keyboard events are handled.<br><br>
         * Child element of {@link OpenSeadragon.Viewer#container},
         * positioned below {@link OpenSeadragon.Viewer#canvas}. 
         * @member {Element} keyboardCommandArea
         * @memberof OpenSeadragon.Viewer#
         */
        keyboardCommandArea: null,
        /**
         * A &lt;div&gt; element, the element where user-input events are handled for panning and zooming.<br><br>
         * Child element of {@link OpenSeadragon.Viewer#container},
         * positioned on top of {@link OpenSeadragon.Viewer#keyboardCommandArea}.<br><br>
         * The parent of {@link OpenSeadragon.Drawer#canvas} instances. 
         * @member {Element} canvas
         * @memberof OpenSeadragon.Viewer#
         */
        canvas:         null,

        //TODO: not sure how to best describe these
        overlays:       [],
        overlayControls:[],

        //private state properties
        previousBody:   [],

        //This was originally initialized in the constructor and so could never
        //have anything in it.  now it can because we allow it to be specified
        //in the options and is only empty by default if not specified. Also
        //this array was returned from get_controls which I find confusing
        //since this object has a controls property which is treated in other
        //functions like clearControls.  I'm removing the accessors.
        customControls: [],

        //These are originally not part options but declared as members
        //in initialize.  It's still considered idiomatic to put them here
        source:         null,
        /**
         * Handles rendering of tiles in the viewer. Created for each TileSource opened.
         * @member {OpenSeadragon.Drawer} drawers
         * @memberof OpenSeadragon.Viewer#
         */
        drawers:        [],
        /**
         * Handles coordinate-related functionality - zoom, pan, rotation, etc. Created for each TileSource opened.
         * @member {OpenSeadragon.Viewport} viewport
         * @memberof OpenSeadragon.Viewer#
         */
        viewport:       null,
        /**
         * @member {OpenSeadragon.Navigator} navigator
         * @memberof OpenSeadragon.Viewer#
         */
        navigator:      null,

        //UI image resources
        //TODO: rename navImages to uiImages
        navImages:      null,

        //interface button controls
        buttons:        null,

        // Don't add any controls
        noControlDock:  false

    }, $.DEFAULT_SETTINGS, options );

    if ( typeof( this.hash) === "undefined" ) {
        throw new Error("A hash must be defined, either by specifying options.id or options.hash.");
    }
    if ( typeof( ViewerStateMap[ this.hash ] ) !== "undefined" ) {
        // We don't want to throw an error here, as the user might have discarded
        // the previous viewer with the same hash and now want to recreate it.
        $.console.warn("Hash " + this.hash + " has already been used.");
    }

    //Private state properties
    ViewerStateMap[ this.hash ] = {
        "fsBoundsDelta":     new $.Point( 1, 1 ),
        "animating":         false,
        "forceRedraw":       false,
        "mouseInside":       false,
        "group":             null,
        // did we decide this viewer has a sequence of tile sources
        "sequenced":         false,
        "sequence":          0,
        "fullPage":          false,
        "onfullscreenchange": null
    };

    this._updateRequestId = null;

    //Inherit some behaviors and properties
    $.EventSource.call( this );

    this.addHandler( 'open-failed', function ( event ) {
        var msg = $.getString( "Errors.OpenFailed", event.eventSource, event.message);
        _this._showMessage( msg );
    });

    // Create a container
    this.container = $.makeFormContainer();

    this.controls = [];

    this.element              = this.element || document.getElementById( this.id );
    this.canvas               = $.makeNeutralElement( "div" );
    this.keyboardCommandArea  = $.makeNeutralElement( "textarea" );

    this.configureElement(this.canvas, "openseadragon-canvas", true);
    this.configureElement(this.container, "openseadragon-container", false, {textAlign:"left",'background-color':'black'});
    this.configureElement(this.keyboardCommandArea, "keyboard-command-area", true);

    this.container.insertBefore( this.canvas, this.container.firstChild );
    this.container.insertBefore( this.keyboardCommandArea, this.container.firstChild );
    this.element.appendChild( this.container );

    //Used for toggling between fullscreen and default container size
    //TODO: these can be closure private and shared across Viewer
    //      instances.
    this.bodyWidth      = document.body.style.width;
    this.bodyHeight     = document.body.style.height;
    this.bodyOverflow   = document.body.style.overflow;
    this.docOverflow    = document.documentElement.style.overflow;

    this.viewerControls = new $.ViewerControls(this, ViewerStateMap);
    this.keyboardCommandArea.innerTracker = this.viewerControls.bindKeyControls();

    this.innerTracker = new $.MouseTracker({
        element:            this.canvas,
        clickTimeThreshold: this.clickTimeThreshold,
        clickDistThreshold: this.clickDistThreshold,
        clickHandler:       $.delegate( this, onCanvasClick ),
        dragHandler:        $.delegate( this, onCanvasDrag ),
        releaseHandler:     $.delegate( this, onCanvasRelease ),
        scrollHandler:      $.delegate( this, onCanvasScroll )
    }).setTracking( this.mouseNavEnabled ? true : false ); // default state

    this.outerTracker = new $.MouseTracker({
        element:            this.container,
        clickTimeThreshold: this.clickTimeThreshold,
        clickDistThreshold: this.clickDistThreshold,
        enterHandler:       $.delegate( this, onContainerEnter ),
        exitHandler:        $.delegate( this, onContainerExit ),
        releaseHandler:     $.delegate( this, onContainerRelease )
    }).setTracking( this.mouseNavEnabled ? true : false ); // always tracking

    if( this.toolbar && !this.noControlDock ){
        $.console.log('Create viewer toolbar ' + this.toolbar );
        this.toolbar = new $.ControlDock({ element: this.toolbar });
    }

    this.viewerControls.bindStandardControls(this);
    this.viewerControls.bindSequenceControls(this);

    for ( i = 0; i < this.customControls.length; i++ ) {
        this.addControl(
            this.customControls[ i ].id,
            {anchor: this.customControls[ i ].anchor}
        );
    }

    this.autoHideHandler = $.delegate( this, this.beginControlsAutoHide);
    $.requestAnimationFrame(this.autoHideHandler);

};

$.extend( $.Viewer.prototype, $.EventSource.prototype, $.ControlDock.prototype, /** @lends OpenSeadragon.Viewer.prototype */{

    configureElement:function(element, name, isAbsolute, extraStyles) {
        element.className = name;
        (function( style ){
            style.width    = "100%";
            style.height   = "100%";
            style.overflow = "hidden";
            style.position = isAbsolute ? "absolute" : "relative";
            style.top      = "0px";
            style.left     = "0px";
            if(extraStyles !== null) {
                for(var s in extraStyles) {
                    style[s] = extraStyles[s];
                }
            }
        }( element.style ));
    },
    /**
     * @function
     * @return {Boolean}
     */
    isOpen: function () {
        return !!this.source;
    },

    /**
     * Open a TileSource object into the viewer.
     *
     * tileSources is a complex option...
     *
     * It can be a string, object, function, or an array of any of these:
     *
     * - A String implies a url used to determine the tileSource implementation
     *      based on the file extension of url. JSONP is implied by *.js,
     *      otherwise the url is retrieved as text and the resulting text is
     *      introspected to determine if its json, xml, or text and parsed.
     * - An Object implies an inline configuration which has a single
     *      property sufficient for being able to determine tileSource
     *      implementation. If the object has a property which is a function
     *      named 'getTileUrl', it is treated as a custom TileSource.
     * @function
     * @param {String|Object|Function}
     * @return {OpenSeadragon.Viewer} Chainable.
     * @fires OpenSeadragon.Viewer.event:open
     * @fires OpenSeadragon.Viewer.event:open-failed
     */
    open: function ( tileSource ) {

        $.console.log('Viewer::open tile source %O',tileSource);

        this._hideMessage();

        var promise = $.TileSourceFactory.create(this, tileSource);
        $.console.log('Tile Source Promise %O',promise.inspect());
        promise.then( $.delegate(this, tileSourceCreateSuccess), $.delegate(this, tileSourceCreateError));

        return this;
    },

    /**
     * @function
     * @return {OpenSeadragon.Viewer} Chainable.
     * @fires OpenSeadragon.Viewer.event:close
     */
    close: function ( ) {
        if ( this._updateRequestId !== null ) {
            $.cancelAnimationFrame( this._updateRequestId );
            this._updateRequestId = null;
        }

        if ( this.navigator ) {
            this.navigator.close();
        }

        if ( this.drawers ) {
            for(var i=0;i<this.drawers.length;i++) {
                this.drawers[i].clearOverlays();
            }
        }

        this.source     = null;
        this.drawers     = null;

        this.viewport   = this.preserveViewport ? this.viewport : null;
        if (this.canvas){
            this.canvas.innerHTML = "";
        }

        VIEWERS[ this.hash ] = null;
        delete VIEWERS[ this.hash ];

        /**
         * Raised when the viewer is closed (see {@link OpenSeadragon.Viewer#close}).
         *
         * @event close
         * @memberof OpenSeadragon.Viewer
         * @type {object}
         * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
         * @property {?Object} userData - Arbitrary subscriber-defined object.
         */
        this.raiseEvent( 'close' );

        return this;
    },


    /**
     * Function to destroy the viewer and clean up everything created by
     * OpenSeadragon.
     * @function
     */
    destroy: function( ) {
        this.close();

        this.removeAllHandlers();

        // Go through top element (passed to us) and remove all children
        // Use removeChild to make sure it handles SVG or any non-html
        // also it performs better - http://jsperf.com/innerhtml-vs-removechild/15
        if (this.element){
            while (this.element.firstChild) {
                this.element.removeChild(this.element.firstChild);
            }
        }

        // destroy the mouse trackers
        if (this.keyboardCommandArea){
            this.keyboardCommandArea.innerTracker.destroy();
        }
        if (this.innerTracker){
            this.innerTracker.destroy();
        }
        if (this.outerTracker){
            this.outerTracker.destroy();
        }

        // clear all our references to dom objects
        this.canvas = null;
        this.keyboardCommandArea = null;
        this.container = null;

        // clear our reference to the main element - they will need to pass it in again, creating a new viewer
        this.element = null;
    },


    /**
     * @function
     * @return {Boolean}
     */
    isMouseNavEnabled: function () {
        return this.innerTracker.isTracking();
    },

    /**
     * @function
     * @param {Boolean} enabled - true to enable, false to disable
     * @return {OpenSeadragon.Viewer} Chainable.
     * @fires OpenSeadragon.Viewer.event:mouse-enabled
     */
    setMouseNavEnabled: function( enabled ){
        this.innerTracker.setTracking( enabled );
        /**
         * Raised when mouse/touch navigation is enabled or disabled (see {@link OpenSeadragon.Viewer#setMouseNavEnabled}).
         *
         * @event mouse-enabled
         * @memberof OpenSeadragon.Viewer
         * @type {object}
         * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
         * @property {Boolean} enabled
         * @property {?Object} userData - Arbitrary subscriber-defined object.
         */
        this.raiseEvent( 'mouse-enabled', { enabled: enabled } );
        return this;
    },


    /**
     * @function
     * @return {Boolean}
     */
    areControlsEnabled: function () {
        var enabled = this.controls.length,
            i;
        for( i = 0; i < this.controls.length; i++ ){
            enabled = enabled && this.controls[ i ].isVisibile();
        }
        return enabled;
    },


    /**
     * Shows or hides the controls (e.g. the default navigation buttons).
     *
     * @function
     * @param {Boolean} true to show, false to hide.
     * @return {OpenSeadragon.Viewer} Chainable.
     * @fires OpenSeadragon.Viewer.event:controls-enabled
     */
    setControlsEnabled: function( enabled ) {
        if( enabled ){
            this.abortControlsAutoHide();
        } else {
            this.beginControlsAutoHide();
        }
        /**
         * Raised when the navigation controls are shown or hidden (see {@link OpenSeadragon.Viewer#setControlsEnabled}).
         *
         * @event controls-enabled
         * @memberof OpenSeadragon.Viewer
         * @type {object}
         * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
         * @property {Boolean} enabled
         * @property {?Object} userData - Arbitrary subscriber-defined object.
         */
        this.raiseEvent( 'controls-enabled', { enabled: enabled } );
        return this;
    },


    /**
     * @function
     * @return {Boolean}
     */
    isFullPage: function () {
        return ViewerStateMap[ this.hash ].fullPage;
    },


    /**
     * Toggle full page mode.
     * @function
     * @param {Boolean} fullPage
     *      If true, enter full page mode.  If false, exit full page mode.
     * @return {OpenSeadragon.Viewer} Chainable.
     * @fires OpenSeadragon.Viewer.event:pre-full-page
     * @fires OpenSeadragon.Viewer.event:full-page
     */
    setFullPage: function( fullPage ) {

        var body = document.body,
            bodyStyle = body.style,
            docStyle = document.documentElement.style,
            _this = this,
            hash,
            nodes,
            i;

        //dont bother modifying the DOM if we are already in full page mode.
        if ( fullPage == this.isFullPage() ) {
            return this;
        }

        var fullPageEventArgs = {
            fullPage: fullPage,
            preventDefaultAction: false
        };
        /**
         * Raised when the viewer is about to change to/from full-page mode (see {@link OpenSeadragon.Viewer#setFullPage}).
         *
         * @event pre-full-page
         * @memberof OpenSeadragon.Viewer
         * @type {object}
         * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
         * @property {Boolean} fullPage - True if entering full-page mode, false if exiting full-page mode.
         * @property {Boolean} preventDefaultAction - Set to true to prevent full-page mode change. Default: false.
         * @property {?Object} userData - Arbitrary subscriber-defined object.
         */
        this.raiseEvent( 'pre-full-page', fullPageEventArgs );
        if ( fullPageEventArgs.preventDefaultAction ) {
            return this;
        }

        if ( fullPage ) {

            this.elementSize = $.getElementSize( this.element );
            this.pageScroll = $.getPageScroll();

            this.elementMargin = this.element.style.margin;
            this.element.style.margin = "0";
            this.elementPadding = this.element.style.padding;
            this.element.style.padding = "0";

            this.bodyMargin = bodyStyle.margin;
            this.docMargin = docStyle.margin;
            bodyStyle.margin = "0";
            docStyle.margin = "0";

            this.bodyPadding = bodyStyle.padding;
            this.docPadding = docStyle.padding;
            bodyStyle.padding = "0";
            docStyle.padding = "0";

            this.bodyWidth = bodyStyle.width;
            this.bodyHeight = bodyStyle.height;
            bodyStyle.width = "100%";
            bodyStyle.height = "100%";

            //when entering full screen on the ipad it wasnt sufficient to leave
            //the body intact as only only the top half of the screen would
            //respond to touch events on the canvas, while the bottom half treated
            //them as touch events on the document body.  Thus we remove and store
            //the bodies elements and replace them when we leave full screen.
            this.previousBody = [];
            ViewerStateMap[ this.hash ].prevElementParent = this.element.parentNode;
            ViewerStateMap[ this.hash ].prevNextSibling = this.element.nextSibling;
            ViewerStateMap[ this.hash ].prevElementWidth = this.element.style.width;
            ViewerStateMap[ this.hash ].prevElementHeight = this.element.style.height;
            nodes = body.childNodes.length;
            for ( i = 0; i < nodes; i++ ) {
                this.previousBody.push( body.childNodes[ 0 ] );
                body.removeChild( body.childNodes[ 0 ] );
            }

            //If we've got a toolbar, we need to enable the user to use css to
            //preserve it in fullpage mode
            if ( this.toolbar && this.toolbar.element ) {
                //save a reference to the parent so we can put it back
                //in the long run we need a better strategy
                this.toolbar.parentNode = this.toolbar.element.parentNode;
                this.toolbar.nextSibling = this.toolbar.element.nextSibling;
                body.appendChild( this.toolbar.element );

                //Make sure the user has some ability to style the toolbar based
                //on the mode
                $.addClass( this.toolbar.element, 'fullpage' );
            }

            $.addClass( this.element, 'fullpage' );
            body.appendChild( this.element );

            this.element.style.height = $.getWindowSize().y + 'px';
            this.element.style.width = $.getWindowSize().x + 'px';

            if ( this.toolbar && this.toolbar.element ) {
                this.element.style.height = (
                    $.getElementSize( this.element ).y - $.getElementSize( this.toolbar.element ).y
                ) + 'px';
            }

            ViewerStateMap[ this.hash ].fullPage = true;

            // mouse will be inside container now
            $.delegate( this, onContainerEnter )( {} );

        } else {

            this.element.style.margin = this.elementMargin;
            this.element.style.padding = this.elementPadding;

            bodyStyle.margin = this.bodyMargin;
            docStyle.margin = this.docMargin;

            bodyStyle.padding = this.bodyPadding;
            docStyle.padding = this.docPadding;

            bodyStyle.width = this.bodyWidth;
            bodyStyle.height = this.bodyHeight;

            body.removeChild( this.element );
            nodes = this.previousBody.length;
            for ( i = 0; i < nodes; i++ ) {
                body.appendChild( this.previousBody.shift() );
            }

            $.removeClass( this.element, 'fullpage' );
            ViewerStateMap[ this.hash ].prevElementParent.insertBefore(
                this.element,
                ViewerStateMap[ this.hash ].prevNextSibling
            );

            //If we've got a toolbar, we need to enable the user to use css to
            //reset it to its original state
            if ( this.toolbar && this.toolbar.element ) {
                body.removeChild( this.toolbar.element );

                //Make sure the user has some ability to style the toolbar based
                //on the mode
                $.removeClass( this.toolbar.element, 'fullpage' );

                this.toolbar.parentNode.insertBefore(
                    this.toolbar.element,
                    this.toolbar.nextSibling
                );
                delete this.toolbar.parentNode;
                delete this.toolbar.nextSibling;
            }

            this.element.style.width = ViewerStateMap[ this.hash ].prevElementWidth;
            this.element.style.height = ViewerStateMap[ this.hash ].prevElementHeight;

            // After exiting fullPage or fullScreen, it can take some time
            // before the browser can actually set the scroll.
            var restoreScrollCounter = 0;
            var restoreScroll = function() {
                $.setPageScroll( _this.pageScroll );
                var pageScroll = $.getPageScroll();
                restoreScrollCounter++;
                if ( restoreScrollCounter < 10 &&
                    pageScroll.x !== _this.pageScroll.x ||
                    pageScroll.y !== _this.pageScroll.y ) {
                    $.requestAnimationFrame( restoreScroll );
                }
            };
            $.requestAnimationFrame( restoreScroll );

            ViewerStateMap[ this.hash ].fullPage = false;

            // mouse will likely be outside now
            $.delegate( this, onContainerExit )( { } );

        }

        if ( this.navigator && this.viewport ) {
            this.navigator.update( this.viewport );
        }

        /**
         * Raised when the viewer has changed to/from full-page mode (see {@link OpenSeadragon.Viewer#setFullPage}).
         *
         * @event full-page
         * @memberof OpenSeadragon.Viewer
         * @type {object}
         * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
         * @property {Boolean} fullPage - True if changed to full-page mode, false if exited full-page mode.
         * @property {?Object} userData - Arbitrary subscriber-defined object.
         */
        this.raiseEvent( 'full-page', { fullPage: fullPage } );

        return this;
    },

    /**
     * Toggle full screen mode if supported. Toggle full page mode otherwise.
     * @function
     * @param {Boolean} fullScreen
     *      If true, enter full screen mode.  If false, exit full screen mode.
     * @return {OpenSeadragon.Viewer} Chainable.
     * @fires OpenSeadragon.Viewer.event:pre-full-screen
     * @fires OpenSeadragon.Viewer.event:full-screen
     */
    setFullScreen: function( fullScreen ) {
        var _this = this;

        if ( !$.supportsFullScreen ) {
            return this.setFullPage( fullScreen );
        }

        if ( $.isFullScreen() === fullScreen ) {
            return this;
        }

        var fullScreeEventArgs = {
            fullScreen: fullScreen,
            preventDefaultAction: false
        };
        /**
         * Raised when the viewer is about to change to/from full-screen mode (see {@link OpenSeadragon.Viewer#setFullScreen}).
         *
         * @event pre-full-screen
         * @memberof OpenSeadragon.Viewer
         * @type {object}
         * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
         * @property {Boolean} fullScreen - True if entering full-screen mode, false if exiting full-screen mode.
         * @property {Boolean} preventDefaultAction - Set to true to prevent full-screen mode change. Default: false.
         * @property {?Object} userData - Arbitrary subscriber-defined object.
         */
        this.raiseEvent( 'pre-full-screen', fullScreeEventArgs );
        if ( fullScreeEventArgs.preventDefaultAction ) {
            return this;
        }

        if ( fullScreen ) {

            this.setFullPage( true );
            // If the full page mode is not actually entered, we need to prevent
            // the full screen mode.
            if ( !this.isFullPage() ) {
                return this;
            }

            this.fullPageStyleWidth = this.element.style.width;
            this.fullPageStyleHeight = this.element.style.height;
            this.element.style.width = '100%';
            this.element.style.height = '100%';

            var onFullScreenChange = function() {
                var isFullScreen = $.isFullScreen();
                if ( !isFullScreen ) {
                    $.removeEvent( document, $.fullScreenEventName, onFullScreenChange );
                    $.removeEvent( document, $.fullScreenErrorEventName, onFullScreenChange );

                    _this.setFullPage( false );
                    if ( _this.isFullPage() ) {
                        _this.element.style.width = _this.fullPageStyleWidth;
                        _this.element.style.height = _this.fullPageStyleHeight;
                    }
                }
                if ( _this.navigator && _this.viewport ) {
                    _this.navigator.update( _this.viewport );
                }
                /**
                 * Raised when the viewer has changed to/from full-screen mode (see {@link OpenSeadragon.Viewer#setFullScreen}).
                 *
                 * @event full-screen
                 * @memberof OpenSeadragon.Viewer
                 * @type {object}
                 * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
                 * @property {Boolean} fullScreen - True if changed to full-screen mode, false if exited full-screen mode.
                 * @property {?Object} userData - Arbitrary subscriber-defined object.
                 */
                _this.raiseEvent( 'full-screen', { fullScreen: isFullScreen } );
            };
            $.addEvent( document, $.fullScreenEventName, onFullScreenChange );
            $.addEvent( document, $.fullScreenErrorEventName, onFullScreenChange );

            $.requestFullScreen( document.body );

        } else {
            $.cancelFullScreen();
        }
        return this;
    },

    /**
     * @function
     * @return {Boolean}
     */
    isVisible: function () {
        return this.container.style.visibility != "hidden";
    },


    /**
     * @function
     * @param {Boolean} visible
     * @return {OpenSeadragon.Viewer} Chainable.
     * @fires OpenSeadragon.Viewer.event:visible
     */
    setVisible: function( visible ){
        this.container.style.visibility = visible ? "" : "hidden";
        /**
         * Raised when the viewer is shown or hidden (see {@link OpenSeadragon.Viewer#setVisible}).
         *
         * @event visible
         * @memberof OpenSeadragon.Viewer
         * @type {object}
         * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
         * @property {Boolean} visible
         * @property {?Object} userData - Arbitrary subscriber-defined object.
         */
        this.raiseEvent( 'visible', { visible: visible } );
        return this;
    },

    /**
     * Gets the active page of a sequence
     * @function
     * @return {Number}
     */
    currentPage: function () {
        return ViewerStateMap[ this.hash ].sequenceIndex;
      },

    /**
     * @function
     * @return {OpenSeadragon.Viewer} Chainable.
     * @fires OpenSeadragon.Viewer.event:page
     */
    goToPage: function( page ){

        $.console.log('Viewer::goToPage %s',page);
        if( page >= 0 && page < this.tileSources.length ){
            /**
             * Raised when the page is changed on a viewer configured with multiple image sources (see {@link OpenSeadragon.Viewer#goToPage}).
             *
             * @event page
             * @memberof OpenSeadragon.Viewer
             * @type {Object}
             * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
             * @property {Number} page - The page index.
             * @property {?Object} userData - Arbitrary subscriber-defined object.
             */
            this.raiseEvent( 'page', { page: page } );

            ViewerStateMap[ this.hash ].sequenceIndex = page;

            this._updateSequenceButtons( page );

            this.open( this.tileSources[ page ] );

            if( this.referenceStrip ){
                this.referenceStrip.setFocus( page );
            }
        }

        return this;
    },

    /**
     * Updates the sequence buttons.
     * @function OpenSeadragon.Viewer.prototype._updateSequenceButtons
     * @private
     * @param {Number} Sequence Value
     */
    _updateSequenceButtons: function (page) {

            if( this.nextButton ){
                if( ( this.tileSources.length - 1 ) === page  ){
                    //Disable next button
                    if(!this.navPrevNextWrap){
                        this.nextButton.disable();
                    }
                } else {
                    this.nextButton.enable();
                }
            }
            if( this.previousButton ){
                if( page > 0 ){
                    //Enable previous button
                    this.previousButton.enable();
                } else {
                    if(!this.navPrevNextWrap){
                        this.previousButton.disable();
                    }
                }
            }
      },
      
    /**
     * Display a message in the viewport
     * @function OpenSeadragon.Viewer.prototype._showMessage
     * @private
     * @param {String} text message
     */
    _showMessage: function ( message ) {
        this._hideMessage();

        var div = $.makeNeutralElement( "div" );
        div.appendChild( document.createTextNode( message ) );

        this.messageDiv = $.makeCenteredNode( div );

        $.addClass(this.messageDiv, "openseadragon-message");

        this.container.appendChild( this.messageDiv );
    },

    /**
     * Hide any currently displayed viewport message
     * @function OpenSeadragon.Viewer.prototype._hideMessage
     * @private
     */
    _hideMessage: function () {
        var div = this.messageDiv;
        if (div) {
            div.parentNode.removeChild(div);
            delete this.messageDiv;
        }
    },
    getCenterForOverlay:function( overlay ) {
        // TODO :
        return new $.Point(
            this.drawers[0].canvas.width >> 1,
            this.drawers[0].canvas.height >> 1
        );
    },
    canRotate:function() {
        return this.drawers[0].canRotate();
    },
    update:function() {
        updateDrawers(this);
    },
    needsDrawUpdate:function() {
        if(this.drawers[0]) {
            return this.drawers[0].needsUpdate();
        } else {
            return false;
        }
        // TODO : optimise
//        for(var i=0;i<this.drawers.length;i++) {
//            if(this.drawers[i].needsUpdate()) {
//                return true;
//            }
//        }
//        return false;
    },
    addOverlay:function(sourceIndex, element, location, overlayPlacement) {
        $.console.log('Add Overlay to source %s. Element %O. Location %O. Placement %s',sourceIndex, element, location, overlayPlacement);
    },
    beginControlsAutoHide:function() {
        if ( !this.autoHideControls ) {
            return;
        }
        this.controlsShouldFade = true;
        this.controlsFadeBeginTime = $.now() + this.controlsFadeDelay;

        window.setTimeout( function() {
            scheduleControlsFade( this );
        }, this.controlsFadeDelay );
    },
    abortControlsAutoHide:function() {
        var i;
        this.controlsShouldFade = false;
        for ( i = this.controls.length - 1; i >= 0; i-- ) {
            this.controls[ i ].setOpacity( 1.0 );
        }
    }
});


/**
 * _getSafeElemSize is like getElementSize(), but refuses to return 0 for x or y,
 * which was causing some calling operations in updateOnce and openTileSource to
 * return NaN.
 * @returns {Point}
 * @private
 */
function _getSafeElemSize (oElement) {
    oElement = $.getElement( oElement );

    return new $.Point(
        (oElement.clientWidth === 0 ? 1 : oElement.clientWidth),
        (oElement.clientHeight === 0 ? 1 : oElement.clientHeight)
    );
}

function tileSourceCreateSuccess(tileSource) {
    $.console.log('Tile Source Created %O',tileSource);

    // 1. Check if its a list of sources and if so, is that list to be treated as a sequence or a collection
    if( $.isArray( tileSource ) && !this.collectionMode ){

        ViewerStateMap[ this.hash ].sequenced = true;

        //Keeps the initial page within bounds
        if ( this.initialPage > tileSource.length - 1 ){
            this.initialPage = tileSource.length - 1;
        }

        //Update the sequence (aka current page) property
        ViewerStateMap[ this.hash ].sequenceIndex = this.initialPage;
    }

    openTileSource(this, tileSource);
}

function tileSourceCreateError(tileSource) {
    $.console.log('Tile Source Creation Failed %O', tileSource);
    /**
     * Raised when an error occurs loading a TileSource.
     *
     * @event open-failed
     * @memberof OpenSeadragon.Viewer
     * @type {object}
     * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
     * @property {String} message
     * @property {String} source
     * @property {?Object} userData - Arbitrary subscriber-defined object.
     */
    this.raiseEvent( 'open-failed', event );
}

    /**
 * @function
 * @private
 */
function openTileSource( viewer, source ) {

    $.console.log('Viewer::openTileSource. Viewer %O. Source %O.',viewer, source);

    var _this = viewer,
        overlay,
        i;

    if ( _this.source ) {
        _this.close( );
    }

    _this.canvas.innerHTML = "";
    viewer.prevContainerSize = _getSafeElemSize( _this.container );

    // Specify common viewport options
    var viewportOptions = {
        containerSize:      viewer.prevContainerSize,
        springStiffness:    _this.springStiffness,
        animationTime:      _this.animationTime,
        minZoomImageRatio:  _this.minZoomImageRatio,
        maxZoomPixelRatio:  _this.maxZoomPixelRatio,
        visibilityRatio:    _this.visibilityRatio,
        wrapHorizontal:     _this.wrapHorizontal,
        wrapVertical:       _this.wrapVertical,
        defaultZoomLevel:   _this.defaultZoomLevel,
        minZoomLevel:       _this.minZoomLevel,
        maxZoomLevel:       _this.maxZoomLevel,
        viewer:             _this
    };

    if( _this.collectionMode ) {

        _this.source = new $.TileSourceCollection({
            rows: _this.collectionRows,
            layout: _this.collectionLayout,
            tileSize: _this.collectionTileSize,
            tileSources: source,
            tileMargin: _this.collectionTileMargin
        });

    } else if( source ){
        _this.source = source;
    }

    viewportOptions.contentSize = _this.source.dimensions;

    $.console.log('Content Size %O',viewportOptions.contentSize);

    _this.viewport = _this.viewport ? _this.viewport : new $.Viewport(viewportOptions);

    if( _this.preserveViewport ){
        _this.viewport.resetContentSize( _this.source.dimensions );
    }

    _this.source.overlays = _this.source.overlays || [];

    _this.drawers = createDrawers(_this, _this.collectionMode ? _this.source.tileSources : _this.source);

        $.console.log('Created Drawers %O',_this.drawers );
    //Instantiate a navigator if configured
    if ( _this.showNavigator  && !_this.collectionMode ){
        // Note: By passing the fully parsed source, the navigator doesn't
        // have to load it again.
        if ( _this.navigator ) {
            _this.navigator.open( source );
        } else {
            _this.navigator = new $.Navigator({
                id:                _this.navigatorId,
                position:          _this.navigatorPosition,
                sizeRatio:         _this.navigatorSizeRatio,
                maintainSizeRatio: _this.navigatorMaintainSizeRatio,
                top:               _this.navigatorTop,
                left:              _this.navigatorLeft,
                width:             _this.navigatorWidth,
                height:            _this.navigatorHeight,
                autoResize:        _this.navigatorAutoResize,
                tileSources:       source,
                tileHost:          _this.tileHost,
                prefixUrl:         _this.prefixUrl,
                overlays:          _this.overlays,
                viewer:            _this
            });
        }
    }

    //Instantiate a referencestrip if configured
    if ( _this.showReferenceStrip  && !_this.referenceStrip ){
        _this.referenceStrip = new $.ReferenceStrip({
            id:          _this.referenceStripElement,
            position:    _this.referenceStripPosition,
            sizeRatio:   _this.referenceStripSizeRatio,
            scroll:      _this.referenceStripScroll,
            height:      _this.referenceStripHeight,
            width:       _this.referenceStripWidth,
            tileSources: _this.tileSources,
            tileHost:    _this.tileHost,
            prefixUrl:   _this.prefixUrl,
            overlays:    _this.overlays,
            viewer:      _this
        });
    }

    ViewerStateMap[ _this.hash ].animating = false;
    ViewerStateMap[ _this.hash ].forceRedraw = true;
    _this._updateRequestId = scheduleUpdate( _this, updateMulti );

    //Assuming you had programatically created a bunch of overlays
    //and added them via configuration
    // TODO : Replace viewer overlay creation with something more sensible later
//    for ( i = 0; i < _this.overlayControls.length; i++ ) {
//
//        overlay = _this.overlayControls[ i ];
//
//        if ( overlay.point ) {
//
//            _this.drawer.addOverlay(
//                overlay.id,
//                new $.Point(
//                    overlay.point.X,
//                    overlay.point.Y
//                ),
//                $.OverlayPlacement.TOP_LEFT
//            );
//
//        } else {
//
//            _this.drawer.addOverlay(
//                overlay.id,
//                new $.Rect(
//                    overlay.rect.Point.X,
//                    overlay.rect.Point.Y,
//                    overlay.rect.Width,
//                    overlay.rect.Height
//                ),
//                overlay.placement
//            );
//
//        }
//    }
    VIEWERS[ _this.hash ] = _this;

    /**
     * Raised when the viewer has opened and loaded one or more TileSources.
     *
     * @event open
     * @memberof OpenSeadragon.Viewer
     * @type {object}
     * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
     * @property {OpenSeadragon.TileSource} source
     * @property {?Object} userData - Arbitrary subscriber-defined object.
     */
    _this.raiseEvent( 'open', { source: source } );

    return _this;
}

function createDrawers(viewer, tileSources) {

    if(!$.isArray(tileSources)) {
        $.console.log('Wrapping tileSources into array %O', tileSources);
        tileSources = [tileSources];
    }
    $.console.log('Create Drawers for Viewer %O with sources %O',viewer, tileSources);

    var drawers = [];
    var drawer = null;

    // Create the rendering elements
    // TODO : Its only really IE 8 that doesn't support canvas but using this
    // https://code.google.com/p/explorercanvas
    // will allow canvas usage in IE, so add that and remove all the 'div' / html renderer support.
    var useCanvas = $.supportsCanvas && viewer.useCanvas;
    var renderContainer = $.makeNeutralElement( useCanvas ? "canvas" : "div" );
    renderContainer.style.width     = "100%";
    renderContainer.style.height    = "100%";
    renderContainer.style.position  = "absolute";
    $.getElement(viewer.canvas).appendChild( renderContainer );

    viewer.canvas = renderContainer;
    viewer.renderingSurface = renderContainer.getContext("2d");

    var gridColours = ['#00FF00','#FFFF00'];

    var i = 0;
    var source = null;
    // First need to find out the total size of all the tileSources when layed out according to collectionLayout
    // At the moment only $.LAYOUT.HORIZONTAL and $.LAYOUT.VERTICAL are supported
    var totalContentSize = new $.Point(0,0);
    // How far away from 0,0 this source is
    var sourceOffsets = [];
    for(i=0;i<tileSources.length;i++) {
        source = tileSources[i];
        if(viewer.collectionLayout === $.LAYOUT.HORIZONTAL) {
            sourceOffsets[i] = new $.Point(totalContentSize.x, 0);
            totalContentSize.x += source.dimensions.x;
            if(source.dimensions.y > totalContentSize.y) {
                totalContentSize.y = source.dimensions.y;
            }
        } else {
            sourceOffsets[i] = new $.Point(0, totalContentSize.y);
            totalContentSize.y += source.dimensions.y;
            if(source.dimensions.x > totalContentSize.x) {
                totalContentSize.x = source.dimensions.x;
            }
        }
    }

    $.console.log('Total Content Size %s', totalContentSize.toString());
    $.console.log('Source Offsets %O',sourceOffsets);

    for(i=0;i<tileSources.length;i++) {
        source = tileSources[i];
        var gridColor = gridColours[i % gridColours.length];

        // Now we have the total content size we create content bounds for each drawer
        // The content bounds are rectangles which define how much each tile source / drawer
        // covers of the whole content area.
        // e.g.
        // For a single source the bounds will be 0,0 -> 1,1
        // For two sources layed out horizontally which have equal dimensions they will be
        // 0,0 -> 0.5,1  and  0.5,0 -> 1,1
        var offset = sourceOffsets[i];
        var contentBounds = new $.Rect(offset.x / totalContentSize.x,offset.y / totalContentSize.y,
                                       source.dimensions.x / totalContentSize.x, source.dimensions.y / totalContentSize.y);
        $.console.log('Content Bounds %s', contentBounds.toString());

        drawer = new $.Drawer({
            sourceIndex:        i,
            viewer:             viewer,
            source:             source,
            contentBounds:      contentBounds,
            viewport:           viewer.viewport,
            element:            viewer.canvas,
            canvas:             renderContainer,
            overlays:           source.overlays,
            maxImageCacheCount: viewer.maxImageCacheCount,
            minZoomImageRatio:  viewer.minZoomImageRatio,
            wrapHorizontal:     viewer.wrapHorizontal,
            wrapVertical:       viewer.wrapVertical,
            immediateRender:    viewer.immediateRender,
            blendTime:          viewer.blendTime,
            alwaysBlend:        viewer.alwaysBlend,
            minPixelRatio:      viewer.minPixelRatio,
            timeout:            viewer.timeout,
            debugMode:          viewer.debugMode,
            debugGridColor:     gridColor
        });

        drawers.push(drawer);
    }

    return drawers;
}


///////////////////////////////////////////////////////////////////////////////
// Schedulers provide the general engine for animation
///////////////////////////////////////////////////////////////////////////////
function scheduleUpdate( viewer, updateFunc ){
    return $.requestAnimationFrame( function(){
        updateFunc( viewer );
    } );
}


//provides a sequence in the fade animation
function scheduleControlsFade( viewer ) {
    $.requestAnimationFrame( function(){
        updateControlsFade( viewer );
    });
}

//determines if fade animation is done or continues the animation
function updateControlsFade( viewer ) {
    var currentTime,
        deltaTime,
        opacity,
        i;
    if ( viewer.controlsShouldFade ) {
        currentTime = $.now();
        deltaTime = currentTime - viewer.controlsFadeBeginTime;
        opacity = 1.0 - deltaTime / viewer.controlsFadeLength;

        opacity = Math.min( 1.0, opacity );
        opacity = Math.max( 0.0, opacity );

        for ( i = viewer.controls.length - 1; i >= 0; i--) {
            if (viewer.controls[ i ].autoFade) {
                viewer.controls[ i ].setOpacity( opacity );
            }
        }

        if ( opacity > 0 ) {
            // fade again
            scheduleControlsFade( viewer );
        }
    }
}


//stop the fade animation on the controls and show them
function abortControlsAutoHide( viewer ) {
    var i;
    viewer.controlsShouldFade = false;
    for ( i = viewer.controls.length - 1; i >= 0; i-- ) {
        viewer.controls[ i ].setOpacity( 1.0 );
    }
}



///////////////////////////////////////////////////////////////////////////////
// Default view event handlers.
///////////////////////////////////////////////////////////////////////////////

function onCanvasClick( event ) {
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
}

function onCanvasDrag( event ) {
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
}

function onCanvasRelease( event ) {
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
}

function onCanvasScroll( event ) {
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
}

function onContainerExit( event ) {
    if ( !event.insideElementPressed ) {
        ViewerStateMap[ this.hash ].mouseInside = false;
        if ( !ViewerStateMap[ this.hash ].animating ) {
            this.beginControlsAutoHide();
        }
    }

    this.raiseEvent( 'container-exit', {
        tracker: event.eventSource,
        position: event.position,
        insideElementPressed: event.insideElementPressed,
        buttonDownAny: event.buttonDownAny,
        originalEvent: event.originalEvent
    });
}

function onContainerRelease( event ) {
    if ( !event.insideElementReleased ) {
        ViewerStateMap[ this.hash ].mouseInside = false;
        if ( !ViewerStateMap[ this.hash ].animating ) {
            this.beginControlsAutoHide();
        }
    }

    this.raiseEvent( 'container-release', {
        tracker: event.eventSource,
        position: event.position,
        insideElementPressed: event.insideElementPressed,
        insideElementReleased: event.insideElementReleased,
        originalEvent: event.originalEvent
    });
}

function onContainerEnter( event ) {
    ViewerStateMap[ this.hash ].mouseInside = true;
    abortControlsAutoHide( this );

    this.raiseEvent( 'container-enter', {
        tracker: event.eventSource,
        position: event.position,
        insideElementPressed: event.insideElementPressed,
        buttonDownAny: event.buttonDownAny,
        originalEvent: event.originalEvent
    });
}


///////////////////////////////////////////////////////////////////////////////
// Page update routines ( aka Views - for future reference )
///////////////////////////////////////////////////////////////////////////////

function updateMulti( viewer ) {
    if ( !viewer.source ) {
        viewer._updateRequestId = null;
        return;
    }

    updateOnce( viewer );

    // Request the next frame, unless we've been closed during the updateOnce()
    if ( viewer.source ) {
        viewer._updateRequestId = scheduleUpdate( viewer, updateMulti );
    }
}

function updateDrawers( viewer ) {
    //$.console.log('Update Drawers %s',viewer.drawers.length);
    // Because the viewer now controls the drawing context, we check here if the container has been resized and
    // resize the canvas aka 'renderingSurface' accordingly

    //TODO
    if ( viewer.useCanvas ) {
        var viewportSize    = viewer.viewport.containerSize;
        if( viewer.canvas.width  != viewportSize.x || viewer.canvas.height != viewportSize.y ) {
            $.console.log('Resize canvas %s,%s to viewport %s for viewer.',viewer.canvas.width,viewer.canvas.height,viewportSize.toString());
            viewer.canvas.width  = viewportSize.x;
            viewer.canvas.height = viewportSize.y;
        }

        // Clear the surface ready to redraw
        viewer.renderingSurface.clearRect( 0, 0, viewportSize.x, viewportSize.y );
    }

    var viewportBounds  = viewer.viewport.getBounds( true );
    var numSections = viewer.drawers.length;

    for(var i=0;i<numSections;i++) {
        viewer.drawers[i].update(viewportBounds);
    }

    if(viewer.debugMode) {
        renderDebugInfo(viewer);
    }
}

function renderDebugInfo(viewer) {
    var ctx = viewer.renderingSurface;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.font = 'small-caps 14px inconsolata';
    ctx.strokeStyle = "#FF00FF";
    ctx.fillStyle = "#FF0077";

    ctx.fillText( "Zoom: " + Math.round(viewer.viewport.getZoom(true) * 100), 0, 12 );
    ctx.fillText( "Bounds: " + viewer.viewport.getBounds(true).toStringRounded(), 0, 24 );
    ctx.fillText( "Center: " + viewer.viewport.getCenter(true).toStringRounded(), 0, 36 );
    ctx.fillText( "Home Bounds: " + viewer.viewport.homeBounds.toStringRounded(), 0, 48 );
    ctx.fillText( "Get Home   : " + viewer.viewport.getHomeBounds().toStringRounded(), 0, 60 );
    ctx.restore();
}

function updateOnce( viewer ) {

    var containerSize,
        animated;

    if ( !viewer.source ) {
        return;
    }

    if ( viewer.autoResize ) {
        containerSize = _getSafeElemSize( viewer.container );
        if ( !containerSize.equals( viewer.prevContainerSize ) ) {
            // maintain image position
            var oldBounds = viewer.viewport.getBounds();
            var oldCenter = viewer.viewport.getCenter();
            resizeViewportAndRecenter(viewer, containerSize, oldBounds, oldCenter);
            viewer.prevContainerSize = containerSize;
            ViewerStateMap[ viewer.hash ].forceRedraw = true;
        }
    }

    animated = viewer.viewport.update();

    if( viewer.referenceStrip ){
        animated = viewer.referenceStrip.update( viewer.viewport ) || animated;
    }

    // TODO : This doesn't belong here as its related to viewport behaviour
    if ( !ViewerStateMap[ viewer.hash ].animating && animated ) {
        viewer.raiseEvent( "animation-start" );
        abortControlsAutoHide( viewer );
    }

    if ( animated ) {
        updateDrawers(viewer);
        if( viewer.navigator ){
            viewer.navigator.update( viewer.viewport );
        }

        viewer.raiseEvent( "animation" );
    } else if ( ViewerStateMap[ viewer.hash ].forceRedraw || viewer.needsDrawUpdate() ) {
        updateDrawers(viewer);
        if( viewer.navigator ){
            viewer.navigator.update( viewer.viewport );
        }
        ViewerStateMap[ viewer.hash ].forceRedraw = false;
    }

    if ( ViewerStateMap[ viewer.hash ].animating && !animated ) {

        viewer.raiseEvent( "animation-finish" );

        if ( !ViewerStateMap[ viewer.hash ].mouseInside ) {
            viewer.beginControlsAutoHide();
        }
    }

    ViewerStateMap[ viewer.hash ].animating = animated;
}

// This function resizes the viewport and recenters the image
// as it was before resizing.
// TODO: better adjust width and height. The new width and height
// should depend on the image dimensions and on the dimensions
// of the viewport before and after switching mode.
function resizeViewportAndRecenter( viewer, containerSize, oldBounds, oldCenter ) {
    var viewport = viewer.viewport;

    // We try to remove blanks as much as possible
    var imageHeight = 1 / viewer.source.aspectRatio;
    var newWidth = oldBounds.width <= 1 ? oldBounds.width : 1;
    var newHeight = oldBounds.height <= imageHeight ?
        oldBounds.height : imageHeight;

    var newBounds = new $.Rect(
        oldCenter.x - ( newWidth / 2.0 ),
        oldCenter.y - ( newHeight / 2.0 ),
        newWidth,
        newHeight
        );

    if(viewer.fixImageZoomWhenResize) {
      // TODO : Can probably do something with bounds calculations which
      // maintains image zoom level rather than the update, check, force zoom dance
      var oldImageZoom = viewport.viewportToImageZoom(viewport.getZoom());
      viewport.resizeToFit( containerSize, true, newBounds );
      var newImageZoom = viewport.viewportToImageZoom(viewport.getZoom());
      if(newImageZoom != oldImageZoom) {
        viewport.zoomTo(viewport.imageToViewportZoom(oldImageZoom), viewport.getCenter(), true);
      }
    } else {
      viewport.resizeToFit( containerSize, true, newBounds );
    }
}

}( OpenSeadragon ));
