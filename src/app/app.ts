import { Component } from '@angular/core';
import { ApplicationShellComponent } from './app/layout/application-shell.component';

@Component({
  imports: [ApplicationShellComponent],
  selector: 'app-root',
  template: '<app-application-shell />',
})
export class App {}
