#![no_std]
#![no_main]

#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable();
}

/// Average BT.601 luma per cell → ramp index in `dst` (row-major, cols*rows bytes).
///
/// # Safety
/// `src` must point at `w*h*4` RGBA bytes; `dst` at `cols*rows` bytes.
#[no_mangle]
pub unsafe extern "C" fn luma_indices(
    src: *const u8,
    w: u32,
    h: u32,
    cell_w: u32,
    cell_h: u32,
    invert: u32,
    ramp_len: u32,
    dst: *mut u8,
) {
    if src.is_null() || dst.is_null() || w == 0 || h == 0 || cell_w == 0 || cell_h == 0 {
        return;
    }
    let ramp_len = ramp_len.max(1);
    let cols = w / cell_w;
    let rows = h / cell_h;
    let stride = w as usize * 4;

    for row in 0..rows {
        for col in 0..cols {
            let x0 = col * cell_w;
            let y0 = row * cell_h;
            let mut sum: u64 = 0;
            let mut n: u64 = 0;
            for y in 0..cell_h {
                let yy = (y0 + y) as usize;
                if yy >= h as usize {
                    break;
                }
                let row_ptr = src.add(yy * stride);
                for x in 0..cell_w {
                    let xx = (x0 + x) as usize;
                    if xx >= w as usize {
                        break;
                    }
                    let p = row_ptr.add(xx * 4);
                    let r = *p as u32;
                    let g = *p.add(1) as u32;
                    let b = *p.add(2) as u32;
                    // 0.299 / 0.587 / 0.114 in 8.8 fixed point
                    sum += (77 * r + 150 * g + 29 * b) as u64;
                    n += 1;
                }
            }
            let mut y8 = if n == 0 { 0 } else { (sum / n / 256) as u32 };
            if invert != 0 {
                y8 = 255 - y8;
            }
            let idx = (y8 * (ramp_len - 1)) / 255;
            *dst.add((row * cols + col) as usize) = idx as u8;
        }
    }
}
