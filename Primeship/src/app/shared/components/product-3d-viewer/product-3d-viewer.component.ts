import { Component, OnInit, OnDestroy, ElementRef, ViewChild, Input, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';

@Component({
  selector: 'app-product-3d-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-3d-viewer.component.html',
  styleUrls: ['./product-3d-viewer.component.scss']
})
export class Product3DViewerComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;
  @Input() productImage: string = '';
  @Input() autoRotate: boolean = true;
  @Input() backgroundColor: string = '#F4F7F9';

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private productMesh!: THREE.Mesh;
  private animationId!: number;
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private rotationVelocity = { x: 0, y: 0 };

  constructor() { }

  ngOnInit(): void {
    this.initThreeJS();
    this.createProduct();
    this.setupLighting();
    this.animate();
  }

  ngAfterViewInit(): void {
    this.handleResize();
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.dispose();
  }

  private initThreeJS(): void {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.backgroundColor);

    // Camera setup
    const container = this.canvasContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Event listeners
    this.setupEventListeners();
  }

  private createProduct(): void {
    // Create a sample product (box with rounded edges)
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x2c3e50,
      metalness: 0.3,
      roughness: 0.4,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });

    this.productMesh = new THREE.Mesh(geometry, material);
    this.productMesh.castShadow = true;
    this.productMesh.receiveShadow = true;
    this.scene.add(this.productMesh);

    // Add a subtle glow effect
    const glowGeometry = new THREE.BoxGeometry(2.1, 2.1, 2.1);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xF85606,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.productMesh.add(glowMesh);
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    this.scene.add(directionalLight);

    // Accent light with brand color
    const accentLight = new THREE.PointLight(0xF85606, 0.5, 100);
    accentLight.position.set(-5, 3, 2);
    this.scene.add(accentLight);

    // Fill light
    const fillLight = new THREE.PointLight(0xffffff, 0.3, 100);
    fillLight.position.set(0, -5, 5);
    this.scene.add(fillLight);
  }

  private setupEventListeners(): void {
    const canvas = this.renderer.domElement;

    // Mouse events
    canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));

    // Touch events for mobile
    canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
    canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
    canvas.addEventListener('touchend', this.onTouchEnd.bind(this));

    // Wheel event for zoom
    canvas.addEventListener('wheel', this.onWheel.bind(this));

    // Window resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private onMouseDown(event: MouseEvent): void {
    this.isDragging = true;
    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    };
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaX = event.clientX - this.previousMousePosition.x;
    const deltaY = event.clientY - this.previousMousePosition.y;

    this.rotationVelocity.x = deltaY * 0.01;
    this.rotationVelocity.y = deltaX * 0.01;

    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    };
  }

  private onMouseUp(): void {
    this.isDragging = false;
  }

  private onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.isDragging = true;
      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.isDragging || event.touches.length !== 1) return;

    event.preventDefault();
    const deltaX = event.touches[0].clientX - this.previousMousePosition.x;
    const deltaY = event.touches[0].clientY - this.previousMousePosition.y;

    this.rotationVelocity.x = deltaY * 0.01;
    this.rotationVelocity.y = deltaX * 0.01;

    this.previousMousePosition = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
  }

  private onTouchEnd(): void {
    this.isDragging = false;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomSpeed = 0.1;
    const delta = event.deltaY > 0 ? zoomSpeed : -zoomSpeed;

    this.camera.position.z = Math.max(2, Math.min(10, this.camera.position.z + delta));
  }

  private handleResize(): void {
    const container = this.canvasContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    // Apply rotation with velocity and damping
    if (this.productMesh) {
      if (!this.isDragging) {
        this.rotationVelocity.x *= 0.95;
        this.rotationVelocity.y *= 0.95;
      }

      if (this.autoRotate && Math.abs(this.rotationVelocity.y) < 0.01) {
        this.productMesh.rotation.y += 0.005;
      } else {
        this.productMesh.rotation.x += this.rotationVelocity.x;
        this.productMesh.rotation.y += this.rotationVelocity.y;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private dispose(): void {
    window.removeEventListener('resize', this.handleResize.bind(this));

    if (this.renderer) {
      this.renderer.dispose();
      const container = this.canvasContainer.nativeElement;
      if (container.contains(this.renderer.domElement)) {
        container.removeChild(this.renderer.domElement);
      }
    }
  }

  // Public methods for external control
  public resetView(): void {
    this.camera.position.set(0, 0, 5);
    this.productMesh.rotation.set(0, 0, 0);
    this.rotationVelocity = { x: 0, y: 0 };
  }

  public setAutoRotate(value: boolean): void {
    this.autoRotate = value;
  }
}
