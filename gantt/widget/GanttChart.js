dojo.provide("gantt.widget.GanttChart");

Ext.Loader.setConfig({ enabled : true });

// remove Ext JS classes from html and body
(function() {
    xjs = gantt.xjscls = [];

    var clean = function(n) {       
        var cls  = n.className.split(" "),
            list = [];

        for (var i = cls.length; i;) {          
            var c = cls[--i];                                                 

            if (c && c.indexOf("x-") == 0) {
                list.push(c);
            }
        }

        dojo.removeClass(n, list);   
        xjs.push.apply(xjs, list);      
    }; 

    Ext.onReady(function() {
        clean(document.body); 
        clean(document.documentElement);                                      
    });
})();

dojo.declare("gantt.widget.GanttChart", dijit._Widget, {
    ganttTitle      : "",
    ganttWidth      : 0,
    ganttHeight     : 0,
    taskCaption     : "",
    taskEntity      : "",
    taskSource      : "",
    taskName        : "",
    taskStart       : "",
    taskEnd         : "",
    taskPercent     : "",
    taskResources   : "",
    dependencyPath  : "",

    taskDependency  : "",

    _projectObj     : null,
    _tasks          : null,
    _taskObjs       : null,
    _resources      : null,
    _assignments    : null,
    _dependencies   : null,
    _taskByGuid     : null,
    _taskById       : null,

    _ganttChart     : null,
    _taskStore      : null,
    _depStore       : null,
    _ganttStart     : null,
    _ganttEnd       : null,


    startup : function() {
        if (this._started) {
            return;
        }

        dojo.addClass(this.domNode, "GanttChart");
        dojo.addClass(this.domNode, gantt.xjscls);

        this.taskDependency = this.dependencyPath.split("/")[0];
        this.inherited(arguments);
    },

    update : function(obj, callback) {
        this._projectObj = obj;

        // guard for tab container
        if (obj && dojo.marginBox(this.domNode).w) {
            this.getTasks(function() {
                this.calcDependencies();
                this.initChart();

                callback();    
            });
        } else {
            callback();
        }
    },

    getTasks : function(callback) {
        this._tasks = [];

        var formatDate = function(epoch) {
            return dojo.date.locale.format(new Date(epoch), {
                selector    : "date",
                datePattern : "yyyy-MM-dd"
            });
        };

        mx.data.action({
            params : {
                actionname : this.taskSource,
                applyto    : "selection",
                guids      : [ this._projectObj.getGuid() ]
            },
            error : dojo.hitch(this, function(e) {
                console.log(this.id + ": An error occurred while fetching tasks: ", e);
            }),
            callback : dojo.hitch(this, function(tasks) {
                this._taskObjs    = tasks;
                this._taskById    = {};
                this._taskByGuid  = {};

                var first = true,
                    min, max;

                for (var i = 1, task; task = tasks[i - 1]; i++) {
                    var start = task.get(this.taskStart),
                        end   = task.get(this.taskEnd);

                    this._tasks.push({
                        Id          : i,
                        Name        : task.get(this.taskName),
                        StartDate   : formatDate(start),
                        EndDate     : formatDate(end),
                        Priority    : 1,
                        PercentDone : task.get(this.taskPercent),
                        Responsible : "",
                        expanded    : true,
                        children    : [],
                        index       : i
                    });

                    var guid = task.getGuid();

                    this._taskById[i] = { guid : guid, task : task };
                    this._taskByGuid[guid] = { id : i, task : task };

                    min = first ? start : Math.min(start, min);
                    max = first ? end   : Math.max(end, max);

                    first = false;
                }

                this._ganttStart = new Date(min - 432e6); // 5 days
                this._ganttEnd   = new Date(max + 432e6);

                callback.call(this);
                this._taskStore.loadData(this._tasks);
            })
        });
    },

    calcDependencies : function() {
        this._dependencies = [];

        var tasks = this._taskObjs;

        for (var i = 0, task; task = tasks[i]; i++) {
            var dep = task.get(this.taskDependency);
            
            if (dep) {
                this._dependencies.push({
                    From : this._taskByGuid[dep].id,
                    To   : this._taskByGuid[task.getGuid()].id,
                    Type : 2
                });
            }
        }
    },

    initChart : function() {
        this._taskStore = Ext.create("Gnt.data.TaskStore");
        this._taskStore.loadData(this._tasks);
        
        this._depStore = Ext.create("Gnt.data.DependencyStore");
        this._depStore.loadData(this._dependencies);

        var gantt = Ext.create("Gnt.panel.Gantt", {
            width             : this.ganttWidth || dojo.marginBox(this.domNode).w,
            height            : this.ganttHeight || 300,
            readOnly          : true,
            renderTo          : this.id,
            leftLabelField    : "Name",
            rightLabelField   : {
                dataIndex : "Id",
                renderer  : dojo.hitch(this, function(value, record) {
                    return this._taskById[value].task.get(this.taskResources);
                })
            },
            startDate         : this._ganttStart,
            endDate           : this._ganttEnd,
            highlightWeekends : true,
            loadMask          : true,
            snapToIncrement   : true,
            title             : this.ganttTitle,
            viewPreset        : "weekAndDayLetter",
            columns : [
                {
                    xtype     : "treecolumn",
                    header    : this.taskCaption,
                    dataIndex : "Name",
                    width     : 150
                }
            ],
            taskStore         : this._taskStore,
            dependencyStore   : this._depStore
        });

        dojo.query("[style*=bryntum-trial]", this.domNode).addClass("trial");
    }
});
