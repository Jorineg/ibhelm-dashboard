- single page design
- big "table" shows tasks, emails and files
- tasks are actually two different things: do-dos and information items. Both of these are stored in teamwork (as tasks) but only to dos are real tasks. infomation items only use tasks for convienence. they dont have a due date, an assignee, etc....
-> four distict items in table: to dos, information items, emails and files
- all four can be toggled to show or hide
- big search bar in top center
- columns can be shown or hidden (there is a button that opens a list where one can select which columns to show)
- if result doesnt contain values in a column, dont show the column (i.e. filename if only tasks are shown. but dont change the selection of columns to show, just down show filename)
- rows can be sorted by clicking on the column header
- columns can be dragged to reorder them
- there is a very sophisitcated filter system:
- filters for project, customer, building, floor, room, Kostengruppe. these are alvays visible.
- make it easy in the code to change the default (always) visible filters.
- via a button there can be opened a list of possible filters. one for each column, which adds a new filter. criteria can be selected from dropdown (eq, neq, contains, does not contain, is empty, is not empty, before, after)
- the current state of all filters can be saved. there is a column on the left with "tabs" that show saved configurations. like chats in a chat app. if clicked on one configuration, all filters will be loaded and applied. stored filters have names which can be edited. stored filters can also be deleted.
- list/gallery view and which of the four item types are shown, is also saved and loaded with the filters.
- there is no storage of individual filters. only all filters (for all columns) together.
- stored in browser storage
- gallery and list view can be toggled. gallery view shows thumbnails of files
- login with google button in beginning. no other login options.
- search bar applies search in addition to filters. search is not saved.
- ui updates while typing in search bar. search searches ALL columns for "contains" or is similar to search term.
- near the filters, there is a section for filter storage options. one for deletion of stored configuration ("delete this filter configuration"), there is a textfield with its name and a button to duplicate the current filter configuration. it will create a new one, append (copy) to old name and make text field active.
- there is always one configuration "active". if a any filter is changed, the active configuration is changed and saved automatically.
- on the right configuration selectin panel, at the very top there is a button to create a new configuration. it will create a new configuration with empty filters and set it as active.
- no pagination, but when scrolling to the bottom of the table, the table will load more data.
- if clicked on a row (or gallery item), an almost page filling popup will appear with details of the item. (there is a checkbox at top to of popup to toggle empty values to be shown. if not, only non-empty values (and their labels) are shown)


- no data entry for now, only to view data
- ignore files for now. not yet in db...
- no inforamtion items yet. all tasks are to dos..., but will be added later.
- database schema not yet great. will be improved later. make it work for current schema for now.
-  do not bother these things for now.... i only want the table layout and functionality as described above.

│  ├── File Browser                                   │
│  ├── Metadata Editor                                │
│  ├── Access Control Panel (Admin only)             │
│  └── External Share View  