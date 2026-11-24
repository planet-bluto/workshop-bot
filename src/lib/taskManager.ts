export default class TaskManager {
	_global_tid: number = 0;
	_pending_tid: null | string = null;
	_tasks: {[tid: string]: () => Promise<any>} = {};
	_proms: {[tid: string]: (...any) => any} = {};

	// _cached_proms = [];

  _running: boolean;
  // running: boolean;
  sync: boolean;

	constructor(running = true, sync = false) {
		// this._running = running
		this.running = running
		this.sync = sync
	}

	set running(value) {
		let continuing = (value == true && this._running == false)
		this._running = value
		if (continuing) {
			this._advance(this._pending_tid)
			this._pending_tid = null
		}
	}

	get running() {
		return this._running
	}

	async _advance(tid) {
		// console.log("ADVANCING!!!")
		let this_task = this._tasks[tid]
		let this_prom = this._proms[tid]

		if (this_task) {
			if (!this.sync) {
				var result = await this_task()
				this_prom(result)
			} else {
				this_task().then(result => {
					this_prom(result)
				})
			}
		}

		delete this._tasks[tid]
		delete this._proms[tid]

		if (this._running && Object.keys(this._tasks).length > 0) {
			var next_tid = String(Number(tid)+1)
			this._advance(next_tid)
		}
	}

	add(task: () => Promise<any>) {
    // let task: Promise<void> = ((typeof(raw_task) == "function") ? raw_task() : raw_task)

		let tid = String(this._global_tid)
		this._global_tid += 1
		this._tasks[tid] = task

		var prom = new Promise((resolve, reject) => {
			this._proms[tid] = resolve
		})

		if (Object.keys(this._tasks).length == 1) {
			if (this._running) {
				this._advance(tid)
			}
		}

		if (!this._running && this._pending_tid == null) {
			this._pending_tid = tid
		}
		return prom
	}
}