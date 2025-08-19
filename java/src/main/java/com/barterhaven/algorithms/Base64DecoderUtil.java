package com.barterhaven.algorithms;

import java.util.Base64;

public final class Base64DecoderUtil {
    private Base64DecoderUtil() {}

    public static byte[] decodeImageDataUri(String dataUri) {
        if (dataUri == null) return new byte[0];
        String base64 = dataUri.replaceFirst("^data:image/[a-zA-Z0-9.+-]+;base64,", "");
        return Base64.getDecoder().decode(base64);
    }

    public static void main(String[] args) {
        String data = "data:image/png;base64," + Base64.getEncoder().encodeToString("hello".getBytes());
        System.out.println(decodeImageDataUri(data).length);
    }
}


