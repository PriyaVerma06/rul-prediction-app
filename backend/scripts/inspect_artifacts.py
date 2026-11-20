import os
from pathlib import Path
import pickle
import joblib

# Suppress TensorFlow logging warnings if possible
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

def inspect():
    artifacts_dir = Path(__file__).resolve().parent.parent / "artifacts"
    print(f"Artifacts directory: {artifacts_dir}\n")

    # 1. feature_columns.pkl
    fc_path = artifacts_dir / "feature_columns.pkl"
    try:
        feature_columns = joblib.load(fc_path)
    except Exception:
        with open(fc_path, "rb") as f:
            feature_columns = pickle.load(f)
    print("=== FEATURE COLUMNS ===")
    print(f"Type: {type(feature_columns)}")
    print(f"Length: {len(feature_columns)}")
    print(f"Columns: {feature_columns}\n")

    # 2. model_config.pkl
    mc_path = artifacts_dir / "model_config.pkl"
    try:
        model_config = joblib.load(mc_path)
    except Exception:
        with open(mc_path, "rb") as f:
            model_config = pickle.load(f)
    print("=== MODEL CONFIG ===")
    print(f"Type: {type(model_config)}")
    print(f"Full dict: {model_config}\n")

    # 3. best_hyperparameters.pkl
    hp_path = artifacts_dir / "best_hyperparameters.pkl"
    if hp_path.exists():
        try:
            hp = joblib.load(hp_path)
        except Exception:
            with open(hp_path, "rb") as f:
                hp = pickle.load(f)
        print("=== BEST HYPERPARAMETERS ===")
        print(f"Type: {type(hp)}")
        print(f"Content: {hp}\n")

    # 4. rul_scaler.pkl
    scaler_path = artifacts_dir / "rul_scaler.pkl"
    try:
        scaler = joblib.load(scaler_path)
    except Exception:
        with open(scaler_path, "rb") as f:
            scaler = pickle.load(f)
    print("=== SCALER ===")
    print(f"Scaler type: {type(scaler)}")
    print(f"n_features_in_: {getattr(scaler, 'n_features_in_', None)}")
    print(f"feature_names_in_: {getattr(scaler, 'feature_names_in_', None)}")
    if hasattr(scaler, "mean_"):
        print(f"mean_ shape: {scaler.mean_.shape}")
        print(f"mean_: {scaler.mean_}")
    if hasattr(scaler, "scale_"):
        print(f"scale_ shape: {scaler.scale_.shape}")
        print(f"scale_: {scaler.scale_}")
    print()

    # 5. final_rul_model.keras
    model_path = artifacts_dir / "final_rul_model.keras"
    print("=== KERAS MODEL ===")
    try:
        import tensorflow as tf
        model = tf.keras.models.load_model(model_path)
        print(f"Model input shape: {model.input_shape}")
        print(f"Model output shape: {model.output_shape}")
        print("Model summary:")
        model.summary(print_fn=lambda x: print(f"  {x}"))
    except Exception as e:
        print(f"Error loading Keras model: {e}")

if __name__ == "__main__":
    inspect()

