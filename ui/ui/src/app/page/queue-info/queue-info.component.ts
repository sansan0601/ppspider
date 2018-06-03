import {AfterContentInit, Component, Inject, OnInit} from '@angular/core';
import {SocketIOService} from "../../service/socket-io.service";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material";
import {PromiseUtil} from "../../util/PromiseUtil";
import {ToasterService} from "angular2-toaster";
import {CommonService} from "../../service/common.service";
import {ConfirmDialog} from "../../widget/confirm-dialog/confirm.dialog";

declare const CodeMirror: any;

@Component({
  selector: 'app-queue-info',
  templateUrl: './queue-info.component.html',
  styleUrls: ['./queue-info.component.css']
})
export class QueueInfoComponent implements OnInit {

  info: any;

  constructor(
    private socketIOService: SocketIOService,
    private commonService: CommonService,
    public dialog: MatDialog,
    private toasterService: ToasterService
  ) {
  }

  ngOnInit() {
    this.info = this.commonService.info;
  }

  stringify(obj) {
    if (obj == null) return "";
    else if (typeof obj == "object") return JSON.stringify(obj);
    else return obj;
  }

  openEditConfig(queue: any, field: string, oldValue: number) {
    const dialogRef = this.dialog.open(EditConfigDialog, {
      width: "400px",
      data: {
        field: field,
        value: oldValue
      }
    });
    dialogRef.afterClosed().subscribe(res => {
      if (res && res.value != null) {
        this.socketIOService.request({
          key: "updateQueueConfig",
          data: {
            queue: queue.name,
            field: field,
            value: res.value
          }
        }, res => {
          this.toasterService.pop(res.success ? "success" : "warning", "Message", res.message);
        });
      }
    });
  }

  resetQueueManagerPause(value: boolean) {
    this.socketIOService.request({
      key: "resetQueueManagerPause",
      data: value
    }, res => {
      this.toasterService.pop("success", "Message", value ? "Pause successfully" : "Resume successfully");
    });
  }

  deleteQueueCache() {
    this.dialog.open(ConfirmDialog, {
      width: "400px",
      data: {
        message: "Delete the queue cache ?"
      }
    }).afterClosed().subscribe(res => {
      if (res) {
        this.socketIOService.request({
          key: "deleteQueueCache",
          data: {}
        }, res => {
          this.toasterService.pop(res.success ? "success" : "warning", "Message", res.message);
        });
      }
    });
  }

  showShutdownConfirm() {
    this.dialog.open(ShutdownConfirmDialog, {
      width: "500px",
      data: {}
    }).afterClosed().subscribe(res => {
      if (res != null) {
        this.info.running = false;
        this.info.queue = {};
      }
    });
  }

}

@Component({
  selector: 'dialog-edit-maxParallelConfig',
  templateUrl: './dialog-edit-maxParallelConfig.html',
  styleUrls: ['./queue-info.component.css']
})
export class EditConfigDialog implements OnInit, AfterContentInit {

  result: any = {};

  valueInput: any;

  constructor(
    public dialogRef: MatDialogRef<EditConfigDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit() {
    if (this.data.value.constructor == Object) {
      try {
        this.data.valueFormat = JSON.stringify(this.data.value, null, 4);
      }
      catch (e) {
      }
    }
  }

  ngAfterContentInit(): void {
    PromiseUtil.waitFor(() => document.getElementById("valueInput") != null).then(res => {
      if (res) {
        this.valueInput = CodeMirror.fromTextArea(document.getElementById("valueInput"), {
          matchBrackets: true,
          autoCloseBrackets: true,
          mode: "application/ld+json",
          lineWrapping: true,
          lineNumbers: true,
          lineHeight: "20px"
        });
        this.valueInput.on('change', (cm, change) => {
          const value = cm.getValue();
          if (value.match('^\\d+$')) {
            this.result.value = parseInt(value);
          }
          else {
            try {
              this.result.value = JSON.parse(value);
            }
            catch (e) {
              this.result.value = value;
            }
          }
        });
      }
    });
  }

}

@Component({
  selector: 'dialog-shutdownCconfirm',
  templateUrl: './dialog-shutdownCconfirm.html',
  styleUrls: ['./queue-info.component.css']
})
export class ShutdownConfirmDialog implements OnInit {

  shutdownProgressValue = -1;

  private shutdownSuccess = false;

  constructor(
    public dialogRef: MatDialogRef<ShutdownConfirmDialog>,
    private socketIOService: SocketIOService,
    private toasterService: ToasterService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit() {
  }

  shutdown(saveState: boolean) {
    this.dialogRef.disableClose = true;
    this.showShutdownProgress();
    this.socketIOService.request({
      key: "stopSystem",
      data: {
        saveState: saveState
      }
    }, res => {
      this.shutdownSuccess = true;
      this.toasterService.pop("success", "Message", "Shutdown successfully");
    });
  }

  private showShutdownProgress() {
    const interval = 100;
    const waitDdelta = 60 * interval / 30000.0;
    let successDelta = 0;
    const update = () => {
      if (this.shutdownSuccess) {
        if (successDelta == 0) successDelta = (100 - this.shutdownProgressValue) * interval / 750.0;
        this.shutdownProgressValue += successDelta;
      }
      else if (this.shutdownProgressValue < 60) {
        this.shutdownProgressValue += waitDdelta;
      }
      if (this.shutdownProgressValue < 100) {
        setTimeout(update, interval);
      }
      else {
        this.dialogRef.close(true);
      }
    };
    update();
  }

}
