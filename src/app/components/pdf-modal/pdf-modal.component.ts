import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { URLUtil } from '../../../utils/url-util';

@Component({
  selector: 'app-pdf-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './pdf-modal.component.html',
  styleUrls: ['./pdf-modal.component.scss']
})
export class PdfModalComponent implements OnInit {
  pdfUrl: SafeResourceUrl | null = null;
  loading = true;
  error = false;

  constructor(
    public dialogRef: MatDialogRef<PdfModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { url: string },
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    try {
      const signUrlBase = URLUtil.getSignUrlApiBaseUrl();
      const signUrlEndpoint = `${signUrlBase}/sign-url`;

      const res = await fetch(signUrlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: this.data.url }),
      });

      if (!res.ok) {
        throw new Error(`Error del servidor: ${res.status} ${res.statusText}`);
      }

      const { signedUrl } = await res.json();

      if (!signedUrl) {
        throw new Error('El servidor no devolvió una URL firmada.');
      }

      this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(signedUrl);
    } catch (e) {
      console.error('Error al obtener la URL firmada:', e);
      this.error = true;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  close() {
    this.dialogRef.close();
  }
}
