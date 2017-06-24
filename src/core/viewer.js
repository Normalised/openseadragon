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

    this.log = $.logFactory.getLogger('osd.viewer');
    this.log.log('Create Viewer %O', options);

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
         * Handles coordinate-related functionality - zoom, pan, rotation, etc.
         * Only one viewport exists
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

    this._updateRequestId = null;

    //Inherit some behaviors and properties
    $.EventSource.call( this );

    this.addHandler( 'open-failed', $.delegate(this,this.openFailed));

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
    this.bodyWidth      = document.body.style.width;
    this.bodyHeight     = document.body.style.height;
    this.bodyOverflow   = document.body.style.overflow;
    this.docOverflow    = document.documentElement.style.overflow;

    this.viewerControls = new $.ViewerControls(this);
    this.keyboardCommandArea.innerTracker = this.viewerControls.bindKeyControls();

    this.mouseTracker = new $.ViewerMouseTracker({
        mouseNavEnabled:this.mouseNavEnabled,
        clickTimeThreshold:this.clickTimeThreshold,
        clickDistThreshold:this.clickDistThreshold,
        canvas:this.canvas,
        container:this.container,
        viewport:this.viewport,
        zoomPerClick:this.zoomPerClick,
        zoomPerScroll:this.zoomPerScroll,
        panHorizontal:this.panHorizontal,
        panVertical:this.panVertical
    });

    if( this.toolbar && !this.noControlDock ){
        this.log.log('Create viewer toolbar ' + this.toolbar );
        this.toolbar = new $.ControlDock({ element: this.toolbar });
    }

    this.viewerControls.bindStandardControls(this);

    this.autoHideHandler = $.delegate( this, this.beginControlsAutoHide);
    this.fullScreenChangeHandler = $.delegate(this, this.onFullScreenChange );
    $.requestAnimationFrame(this.autoHideHandler);

};

$.extend( $.Viewer.prototype, $.EventSource.prototype, $.ControlDock.prototype, /** @lends OpenSeadragon.Viewer.prototype */{

    openFailed:function(event) {
      this.log.warn('Couldnt open tile source %O', event);
      this.failed = true;
      if(this.failedImage === null) {
//        this.log.log('Creating failed image');
        this.failedImage = document.createElement('img');
        this.failedImage.src = 'images/no_image.png';
        this.failedImage.style.display = 'block';
        this.failedImage.style.margin = '0 auto';
        this.failedImage.style.height = '100%';
      } else {
//        this.log.log('Using existing failed image');
      }
      this.canvas.appendChild(this.failedImage);
    },
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
        this.log.log('Configured element %O', element);
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


        if(this.failedImage && (this.failedImage.parentNode === this.canvas)) {
          //this.canvas.removeChild(this.failedImage);
          //this.failedImage = null;
        }

        this.log.log('Viewer::open tile source %O',tileSource);

        this._hideMessage();

        var promise = $.TileSourceFactory.create(this, tileSource);
        this.log.log('Tile Source Promise %O',promise.inspect());
        promise.then( $.delegate(this, this.tileSourceCreateSuccess), $.delegate(this, this.tileSourceCreateError));

        return this;
    },

    /**
     * @function
     * @return {OpenSeadragon.Viewer} Chainable.
     * @fires OpenSeadragon.Viewer.event:close
     */
    close: function ( ) {

        this.log.log('Close Viewer');

        if ( this._updateRequestId !== null ) {
            $.cancelAnimationFrame( this._updateRequestId );
            this._updateRequestId = null;
        }

        if ( this.navigator ) {
            this.navigator.close();
        }

        if ( this.drawers ) {
            for(var i=0;i<this.drawers.length;i++) {
                this.drawers[i].cleanup();
            }
        }

        this.source     = null;
        this.drawers     = null;

        this.viewport   = this.preserveViewport ? this.viewport : null;
        if (this.canvas){
            this.canvas.innerHTML = "";
        }

        this.raiseEvent( 'close' );

        return this;
    },


    /**
     * Function to destroy the viewer and clean up everything created by
     * OpenSeadragon.
     * @function
     */
    destroy: function( ) {
        this.log.log('Destroy viewer');
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
        if(this.mouseTracker) {
            this.mouseTracker.destroy();
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
        return this.mouseTracker.innerTracker.tracking;
    },
    /**
     * @function
     * @param {Boolean} enabled - true to enable, false to disable
     * @return {OpenSeadragon.Viewer} Chainable.
     * @fires OpenSeadragon.Viewer.event:mouse-enabled
     */
    setMouseNavEnabled: function( enabled ){
        this.mouseTracker.innerTracker.setTracking( enabled );
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
        this.raiseEvent( 'controls-enabled', { enabled: enabled } );
        return this;
    },


    /**
     * @function
     * @return {Boolean}
     */
    isFullPage: function () {
        this.log.log('isFullPage %s',this.fullPage);
        return this.fullPage;
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

        this.log.log('Set fullpage %s',fullPage);
        var body = document.body,
            bodyStyle = body.style,
            docStyle = document.documentElement.style,
            _this = this,
            nodes,
            i;

        //dont bother modifying the DOM if we are already in full page mode.
        if ( fullPage == this.fullPage ) {
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
            this.prevElementParent = this.element.parentNode;
            this.prevNextSibling = this.element.nextSibling;
            this.prevElementWidth = this.element.style.width;
            this.prevElementHeight = this.element.style.height;
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

            this.fullPage = true;

            this.log.log('Created full page %s',this.fullPage);
            // mouse will be inside container now
            //$.delegate( this, onContainerEnter )( {} );
            this.mouseTracker.onContainerEnter(null);

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
            this.prevElementParent.insertBefore(
                this.element,
                this.prevNextSibling
            );

            //If we've got a toolbar, we need to enable the user to use css to
            //reset it to its original state
            if ( this.toolbar && this.toolbar.element ) {
                this.log.log('Remove toolbar %O',this.toolbar);

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

            this.element.style.width = this.prevElementWidth;
            this.element.style.height = this.prevElementHeight;

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

            this.fullPage = false;

            // mouse will likely be outside now
            this.mouseTracker.onContainerExit(null);
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

        this.log.log('Supports Full Screen %s', $.supportsFullScreen);
        this.log.log('Is Full Screen %s', $.isFullScreen());

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
            this.log.log('After set full page %s', this.fullPage);
            if ( !this.fullPage ) {
                return this;
            }

            this.fullPageStyleWidth = this.element.style.width;
            this.fullPageStyleHeight = this.element.style.height;
            this.element.style.width = '100%';
            this.element.style.height = '100%';

            $.addEvent( document, $.fullScreenEventName, this.fullScreenChangeHandler );
            $.addEvent( document, $.fullScreenErrorEventName, this.fullScreenChangeHandler );

            this.log.log('Requesting full screen');
            $.requestFullScreen( document.body );

        } else {
            $.cancelFullScreen();
        }
        return this;
    },
    onFullScreenChange:function() {
      var isFullScreen = $.isFullScreen();
      this.log.log('On full screen change %s',isFullScreen);

      if ( !isFullScreen ) {
        $.removeEvent( document, $.fullScreenEventName, this.fullScreenChangeHandler);
        $.removeEvent( document, $.fullScreenErrorEventName, this.fullScreenChangeHandler);

        this.setFullPage( false );
        if ( this.fullPage ) {
          this.element.style.width = this.fullPageStyleWidth;
          this.element.style.height = this.fullPageStyleHeight;
        }
      }
      if ( this.navigator && this.viewport ) {
        this.navigator.update( this.viewport );
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
      this.raiseEvent( 'full-screen', { fullScreen: isFullScreen } );
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
        this.raiseEvent( 'visible', { visible: visible } );
        return this;
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
        this.updateDrawers();
    },
    needsDrawUpdate:function() {
        // TODO : optimise
        for(var i=0;i<this.drawers.length;i++) {
            if(this.drawers[i].needsUpdate()) {
                return true;
            }
        }
        return false;
    },
    addOverlay:function(sourceIndex, element, location, overlayPlacement) {
        this.log.log('Add Overlay to source %s. Element %O. Location %O. Placement %s',sourceIndex, element, location, overlayPlacement);
    },
    addLayerToSource:function(sourceIndex, renderable) {
        var drawer = this.drawers[sourceIndex];
        if(drawer === null) {
            this.log.warn('Drawer is null for sourceIndex %s',sourceIndex);
        } else {
            this.log.log('Add Layer To Source %s %O',sourceIndex, renderable);
            drawer.addLayer(renderable);
        }
    },
    removeLayerFromSource:function(sourceIndex, renderable) {
        var drawer = this.drawers[sourceIndex];
        if(drawer === null) {
            this.log.warn('Drawer is null for sourceIndex %s',sourceIndex);
        } else {
            drawer.removeLayer(renderable);
        }
    },
    showLayers:function(show) {
        for (var i = 0; i < this.drawers.length; i++) {
            this.drawers[i].showLayers(show);
        }
        if(!this.animated) {
            this.update();
        }
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
    },
    updateDrawers:function() {
        //this.log.log('Update Drawers %s',viewer.drawers.length);
        // Because the viewer now controls the drawing context, we check here if the container has been resized and
        // resize the canvas aka 'renderingSurface' accordingly

        //TODO
        if ( this.useCanvas ) {
            var viewportSize    = this.viewport.containerSize;
            if( this.renderContainer.width  != viewportSize.x || this.renderContainer.height != viewportSize.y ) {
                this.log.log('Resize canvas %s,%s to viewport %s for viewer.',this.renderContainer.width,this.renderContainer.height,viewportSize.toString());
                this.renderContainer.width  = viewportSize.x;
                this.renderContainer.height = viewportSize.y;
            }

            // Clear the surface ready to redraw
            this.renderingSurface.clearRect( 0, 0, viewportSize.x, viewportSize.y );
        }

        var viewportBounds  = this.viewport.getBounds( true );
        var numSections = this.drawers.length;

        for(var i=0;i<numSections;i++) {
            this.drawers[i].update(viewportBounds);
        }

        if(this.debugMode) {
            this.debugRender();
        }
    },
    debugRender:function() {
        var ctx = this.renderingSurface;
        ctx.save();
        ctx.lineWidth = 2;
        ctx.font = 'small-caps 16px inconsolata';
        var lineHeight = 14;
        if(this.renderDebugLineIndex > 0) {
            ctx.fillStyle = "#000000";
            ctx.globalAlpha = 0.6;
            ctx.fillRect(0,0,300,(this.renderDebugLineIndex * lineHeight) + 10);
            ctx.globalAlpha = 1.0;
        }
        ctx.strokeStyle = "#FF00FF";
        ctx.fillStyle = "#FF0077";

        this.renderDebugLineIndex = 0;
        this.renderDebugLine( "Container: " + this.viewport.containerSize.toString());
        this.renderDebugLine( "Zoom: " + Math.round(this.viewport.getZoom(true) * 100) + "%");
        this.renderDebugLine( "Viewport Bounds: " + this.viewport.getBounds(true).toStringRounded());
        this.renderDebugLine( "Center: " + this.viewport.getCenter(true).toStringRounded());
        this.renderDebugLine( "Home Bounds: " + this.viewport.homeBounds.toStringRounded());
        this.renderDebugLine( "Get Home   : " + this.viewport.getHomeBounds().toStringRounded());
        this.renderDebugLine( "Center Spring   : " + this.viewport.centerSpringX.current.value.toFixed(3) + ", " + this.viewport.centerSpringY.current.value.toFixed(3));

        for(var i=0;i<this.drawers.length;i++) {
            this.drawers[i].debugRender();
        }
        ctx.restore();
    },
    renderDebugLine:function(text) {
        this.renderDebugLineIndex++;
        this.renderingSurface.fillText(text, 0, this.renderDebugLineIndex * 14);
    },
    createDrawers:function(tileSources) {

        if(!$.isArray(tileSources)) {
            this.log.log('Wrapping tileSources into array %O', tileSources);
            tileSources = [tileSources];
        }
        this.log.log('Create Drawers for Viewer %O with sources %O',this, tileSources);

        var drawers = [];
        var drawer = null;

        // Create the rendering elements
        // TODO : Its only really IE 8 that doesn't support canvas but using this
        // https://code.google.com/p/explorercanvas
        // will allow canvas usage in IE, so add that and remove all the 'div' / html renderer support.
        var useCanvas = $.supportsCanvas && this.useCanvas;
        if(this.renderContainer !== null) {
            this.renderContainer = $.makeNeutralElement( useCanvas ? "canvas" : "div" );
            this.renderContainer.style.width     = "100%";
            this.renderContainer.style.height    = "100%";
            this.renderContainer.style.position  = "absolute";
            $.getElement(this.canvas).appendChild( this.renderContainer );

            //this.canvas = renderContainer;
            this.renderingSurface = this.renderContainer.getContext("2d");
        } else {
            this.log.log('Re-using existing canvas / render container');
        }

        var gridColours = ['#00FF00','#FFFF00'];
        var textColours = ['#FF7700','#77FF00'];
        var i = 0;
        var source = null;
        // First need to find out the total size of all the tileSources when layed out according to collectionLayout
        // At the moment only $.LAYOUT.HORIZONTAL and $.LAYOUT.VERTICAL are supported
        var totalContentSize = new $.Point(0,0);
        // How far away from 0,0 this source is
        var sourceOffsets = [];
        // Pixel margins, array of Rect
        var margins = [];
        for(i=0;i<tileSources.length;i++) {
            source = tileSources[i];
            if(this.collectionLayout === $.LAYOUT.HORIZONTAL) {
                sourceOffsets[i] = new $.Point(totalContentSize.x, 0);
                totalContentSize.x += source.dimensions.x;
                if(source.dimensions.y > totalContentSize.y) {
                    totalContentSize.y = source.dimensions.y;
                }
                if(this.source.margin) {
                    margins[i] = new $.Rect(this.source.margin * i,0,0,0);
                }
            } else {
                sourceOffsets[i] = new $.Point(0, totalContentSize.y);
                totalContentSize.y += source.dimensions.y;
                if(source.dimensions.x > totalContentSize.x) {
                    totalContentSize.x = source.dimensions.x;
                }
                if(this.source.margin) {
                    margins[i] = new $.Rect(0,this.source.margin * i,0,0);
                }
            }

        }

        this.log.log('Total Content Size %s', totalContentSize.toString());
        this.log.log('Source Offsets %O',sourceOffsets);

        for(i=0;i<tileSources.length;i++) {
            source = tileSources[i];
            var gridColor = gridColours[i % gridColours.length];
            var textColor = textColours[i % textColours.length];

            // Now we have the total content size we create content bounds for each drawer
            // The content bounds are rectangles which define how much each tile source / drawer
            // covers of the whole content area.
            // e.g.
            // For a single source the bounds will be 0,0 -> 1,1
            // For two sources laid out horizontally which have equal dimensions they will be
            // 0,0 -> 0.5,1  and  0.5,0 -> 1,1
            var offset = sourceOffsets[i];
            if(this.collectionLayout === $.LAYOUT.HORIZONTAL) {
                offset.y +=  (totalContentSize.y - source.dimensions.y) * 0.5;
            } else {
                offset.x += (totalContentSize.x - source.dimensions.x) * 0.5;
            }
            var contentBounds = new $.Rect(offset.x / totalContentSize.x,offset.y / totalContentSize.y,
                source.dimensions.x / totalContentSize.x, source.dimensions.y / totalContentSize.y);

            this.log.log('Content Bounds %s', contentBounds.toString());

            drawer = new $.Drawer({
                sourceIndex:        i,
                viewer:             this,
                source:             source,
                contentBounds:      contentBounds,
                viewport:           this.viewport,
                element:            this.canvas,
                canvas:             this.renderContainer,
                overlays:           source.overlays,
                maxImageCacheCount: this.maxImageCacheCount,
                minZoomImageRatio:  this.minZoomImageRatio,
                wrapHorizontal:     this.wrapHorizontal,
                wrapVertical:       this.wrapVertical,
                immediateRender:    this.immediateRender,
                blendTime:          this.blendTime,
                alwaysBlend:        this.alwaysBlend,
                minPixelRatio:      this.minPixelRatio,
                timeout:            this.timeout,
                debugMode:          this.debugMode,
                debugGridColor:     gridColor,
                debugTextColor:     textColor,
                margin:             margins[i]
            });

            drawers.push(drawer);
        }

        return drawers;
    },
    openTileSource:function( source ) {

        this.log.log('Viewer::openTileSource. Viewer %O. Source %O.',this, source);

        if ( this.source ) {
            this.log.log('Closing existing source');
            this.close( );
        }

        this.canvas.innerHTML = "";
        this.prevContainerSize = _getSafeElemSize( this.container );

        if( this.collectionMode ) {

          this.log.log('Create TileSourceCollection for collectionMode');
            this.source = new $.TileSourceCollection({
                layout: this.collectionLayout,
                tileSources: source,
                margin: this.collectionMargin
            });

        } else if( source ){
            this.source = source;
        }

        this.createViewport();

        this.source.overlays = this.source.overlays || [];

        this.drawers = this.createDrawers(this.collectionMode ? this.source.tileSources : this.source);

        this.log.log('Created Drawers %O',this.drawers );
        //Instantiate a navigator if configured
        if ( this.showNavigator  && !this.collectionMode ){
            this.createNavigator();
        }

        //Instantiate a referencestrip if configured
        if ( this.showReferenceStrip  && !this.referenceStrip ){
            this.createReferenceStrip();
        }

        this.animating = false;
        this.forceRedraw = true;
        this._updateRequestId = scheduleUpdate( this, updateMulti );

        this.raiseEvent( 'open', { source: source } );

        return this;
    },
    createViewport:function() {

      this.log.log('Create Viewport. Existing : %O', this.viewport);
      if(!this.viewport) {
        // Specify common viewport options
        var viewportOptions = {
          containerSize:      this.prevContainerSize,
          springStiffness:    this.springStiffness,
          animationTime:      this.animationTime,
          minZoomImageRatio:  this.minZoomImageRatio,
          maxZoomPixelRatio:  this.maxZoomPixelRatio,
          visibilityRatio:    this.visibilityRatio,
          wrapHorizontal:     this.wrapHorizontal,
          wrapVertical:       this.wrapVertical,
          defaultZoomLevel:   this.defaultZoomLevel,
          minZoomLevel:       this.minZoomLevel,
          maxZoomLevel:       this.maxZoomLevel,
          contentSize:        this.source.dimensions,
          viewer:             this
        };

        this.viewport = new $.Viewport(viewportOptions);
        this.mouseTracker.viewport = this.viewport;
      } else if( this.preserveViewport ) {
          this.log.log('Preserving viewport');
          this.viewport.resetContentSize( this.source.dimensions );
      }
    },
    createNavigator:function() {
        // Note: By passing the fully parsed source, the navigator doesn't
        // have to load it again.
        if ( this.navigator ) {
            this.navigator.open( this.source );
        } else {
            this.navigator = new $.Navigator({
                id:                this.navigatorId,
                position:          this.navigatorPosition,
                sizeRatio:         this.navigatorSizeRatio,
                maintainSizeRatio: this.navigatorMaintainSizeRatio,
                top:               this.navigatorTop,
                left:              this.navigatorLeft,
                width:             this.navigatorWidth,
                height:            this.navigatorHeight,
                autoResize:        this.navigatorAutoResize,
                tileSources:       this.source,
                tileHost:          this.tileHost,
                prefixUrl:         this.prefixUrl,
                overlays:          this.overlays,
                viewer:            this
            });
        }
    },
    tileSourceCreateSuccess:function(tileSource) {
        this.log.log('Tile Source Created %O',tileSource);

        if($.isArray ( tileSource )) {
            this.collectionMode = true;
        }
        this.openTileSource(tileSource);
    },
    tileSourceCreateError:function(tileSource) {
        this.log.log('Tile Source Creation Failed %O', tileSource);
        this.raiseEvent( 'open-failed', event );
    },
    resizeViewportAndRecenter:function( containerSize, oldBounds, oldCenter ) {

      this.log.log('ResizeViewportAndCenter %O',this);
        // This function resizes the viewport and recenters the image
        // as it was before resizing.
        // TODO: better adjust width and height. The new width and height
        // should depend on the image dimensions and on the dimensions
        // of the viewport before and after switching mode.

        // We try to remove blanks as much as possible
        var imageHeight = 1 / this.source.aspectRatio;
        var newWidth = oldBounds.width <= 1 ? oldBounds.width : 1;
        var newHeight = oldBounds.height <= imageHeight ?
            oldBounds.height : imageHeight;

        var newBounds = new $.Rect(
            oldCenter.x - ( newWidth / 2.0 ),
            oldCenter.y - ( newHeight / 2.0 ),
            newWidth,
            newHeight
        );

        if(this.fixImageZoomWhenResize) {
            // TODO : Can probably do something with bounds calculations which
            // maintains image zoom level rather than the update, check, force zoom dance
            var oldImageZoom = this.viewport.viewportToImageZoom(this.viewport.getZoom(false));
            this.viewport.resizeToFit( containerSize, true, newBounds );
            var newImageZoom = this.viewport.viewportToImageZoom(this.viewport.getZoom(false));
            if(newImageZoom != oldImageZoom) {
                this.viewport.zoomTo(this.viewport.imageToViewportZoom(oldImageZoom), this.viewport.getCenter(), true);
            }
        } else {
            this.viewport.resizeToFit( containerSize, true, newBounds );
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
            viewer.resizeViewportAndRecenter(containerSize, oldBounds, oldCenter);
            viewer.prevContainerSize = containerSize;
            viewer.forceRedraw = true;
        }
    }

    animated = viewer.viewport.update();

    if( viewer.referenceStrip ){
        animated = viewer.referenceStrip.update( viewer.viewport ) || animated;
    }

    // TODO : This doesn't belong here as its related to viewport behaviour
    if ( !viewer.animating && animated ) {
        viewer.raiseEvent( "animation-start" );
        abortControlsAutoHide( viewer );
    }

    if ( animated ) {
        viewer.updateDrawers();
        if( viewer.navigator ){
            viewer.navigator.update( viewer.viewport );
        }

        viewer.raiseEvent( "animation" );
    } else if ( viewer.forceRedraw || viewer.needsDrawUpdate() ) {
        viewer.updateDrawers();
        if( viewer.navigator ){
            viewer.navigator.update( viewer.viewport );
        }
        viewer.forceRedraw = false;
    }

    if ( viewer.animating && !animated ) {

        viewer.raiseEvent( "animation-finish" );

        if ( viewer.mouseTracker.mouseInside ) {
            viewer.beginControlsAutoHide();
        }
    }

    viewer.animating = animated;
}

}( OpenSeadragon ));
